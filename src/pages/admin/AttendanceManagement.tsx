import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { FileDown, CalendarIcon, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface Department {
  department_id: string;
  department_name: string;
}

interface Group {
  group_id: string;
  group_name: string;
  start_time: string | null;
  department_id: string;
}

interface User {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  group_id: string | null;
  department_id: string | null;
}

interface AttendanceData {
  user: User;
  attendance: {
    attendance_id: string;
    check_in_time: string | null;
    check_out_time: string | null;
    status: string;
    location: string | null;
    created_at: string;
  } | null;
  group: Group | null;
}

export default function AttendanceManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter states
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [createdAtStartDate, setCreatedAtStartDate] = useState<Date | undefined>();
  const [createdAtEndDate, setCreatedAtEndDate] = useState<Date | undefined>();
  const [checkInStartTime, setCheckInStartTime] = useState('');
  const [checkInEndTime, setCheckInEndTime] = useState('');
  const [checkOutStartTime, setCheckOutStartTime] = useState('');
  const [checkOutEndTime, setCheckOutEndTime] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Early out dialog states
  const [showEarlyOutDialog, setShowEarlyOutDialog] = useState(false);
  const [selectedAttendanceId, setSelectedAttendanceId] = useState<string>('');
  const [earlyOutTime, setEarlyOutTime] = useState('');
  
  // Present dialog states
  const [showPresentDialog, setShowPresentDialog] = useState(false);
  const [checkInTime, setCheckInTime] = useState('');
  
  // Late dialog states
  const [showLateDialog, setShowLateDialog] = useState(false);
  const [lateCheckInTime, setLateCheckInTime] = useState('');

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      fetchGroups();
      fetchAttendanceData();
    }
  }, [selectedDepartment, selectedGroup]);

  // Set up real-time subscription for attendance changes
  useEffect(() => {
    if (!selectedDepartment) return;

    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        () => {
          // Refresh attendance data when any change occurs
          fetchAttendanceData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDepartment, selectedGroup]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('department')
        .select('department_id, department_name')
        .order('department_name');

      if (error) throw error;
      setDepartments(data || []);
      if (data && data.length > 0) {
        setSelectedDepartment(data[0].department_id);
      }
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('group')
        .select('group_id, group_name, start_time, department_id')
        .eq('department_id', selectedDepartment)
        .order('group_name');

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast.error('Failed to load groups');
    }
  };

  const fetchAttendanceData = async () => {
    try {
      setLoading(true);
      
      // Build query for users
      let usersQuery = supabase
        .from('users')
        .select('user_id, first_name, last_name, username, group_id, department_id')
        .eq('department_id', selectedDepartment);

      if (selectedGroup !== 'all') {
        usersQuery = usersQuery.eq('group_id', selectedGroup);
      }

      const { data: users, error: usersError } = await usersQuery;
      if (usersError) throw usersError;

      // Fetch all attendance records (no date filtering)
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .order('created_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      // Fetch groups for start_time comparison
      const { data: groupsData, error: groupsError } = await supabase
        .from('group')
        .select('group_id, group_name, start_time, department_id');

      if (groupsError) throw groupsError;

      // Map attendance records with user data
      const mappedData: AttendanceData[] = (attendanceRecords || [])
        .filter(record => {
          // Filter by selected users
          const user = users?.find(u => u.user_id === record.user_id);
          return user !== undefined;
        })
        .map(record => {
          const user = users?.find(u => u.user_id === record.user_id)!;
          const userGroup = groupsData?.find(g => g.group_id === user.group_id);

          return {
            user,
            attendance: {
              attendance_id: record.attendance_id,
              check_in_time: record.check_in_time,
              check_out_time: record.check_out_time,
              status: record.status || 'absent',
              location: record.location,
              created_at: record.created_at,
            },
            group: userGroup || null,
          };
        });

      setAttendanceData(mappedData);
      setFilteredData(mappedData);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  // Apply filters whenever filter values or attendance data change
  useEffect(() => {
    let filtered = [...attendanceData];

    // Filter by user search
    if (userSearchQuery) {
      filtered = filtered.filter(data => 
        getUserName(data.user).toLowerCase().includes(userSearchQuery.toLowerCase())
      );
    }

    // Filter by created_at date range
    if (createdAtStartDate && createdAtEndDate) {
      filtered = filtered.filter(data => {
        if (!data.attendance?.created_at) return false;
        const createdDate = new Date(data.attendance.created_at);
        createdDate.setHours(0, 0, 0, 0);
        const start = new Date(createdAtStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(createdAtEndDate);
        end.setHours(23, 59, 59, 999);
        return createdDate >= start && createdDate <= end;
      });
    }

    // Filter by check-in time range
    if (checkInStartTime && checkInEndTime) {
      filtered = filtered.filter(data => {
        if (!data.attendance?.check_in_time) return false;
        const checkInDate = new Date(data.attendance.check_in_time);
        const timeString = format(checkInDate, 'HH:mm');
        return timeString >= checkInStartTime && timeString <= checkInEndTime;
      });
    }

    // Filter by check-out time range
    if (checkOutStartTime && checkOutEndTime) {
      filtered = filtered.filter(data => {
        if (!data.attendance?.check_out_time) return false;
        const checkOutDate = new Date(data.attendance.check_out_time);
        const timeString = format(checkOutDate, 'HH:mm');
        return timeString >= checkOutStartTime && timeString <= checkOutEndTime;
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(data => 
        data.attendance?.status === statusFilter || (!data.attendance && statusFilter === 'absent')
      );
    }

    setFilteredData(filtered);
  }, [attendanceData, userSearchQuery, createdAtStartDate, createdAtEndDate, checkInStartTime, checkInEndTime, checkOutStartTime, checkOutEndTime, statusFilter]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status.toLowerCase()) {
      case 'present':
        return 'success';
      case 'late':
        return 'warning';
      case 'early_out':
        return 'secondary';
      case 'no_checkout':
        return 'destructive';
      case 'absent':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getUserName = (user: User) => {
    return user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.username || 'Unknown User';
  };

  const handleStatusChange = async (attendanceId: string, newStatus: 'present' | 'late' | 'early_out' | 'no_checkout' | 'absent') => {
    // If present, show dialog to input check_in_time
    if (newStatus === 'present') {
      setSelectedAttendanceId(attendanceId);
      setShowPresentDialog(true);
      return;
    }
    
    // If late, show dialog to input check_in_time
    if (newStatus === 'late') {
      setSelectedAttendanceId(attendanceId);
      setShowLateDialog(true);
      return;
    }
    
    // If early_out, show dialog to input check_out_time
    if (newStatus === 'early_out') {
      setSelectedAttendanceId(attendanceId);
      setShowEarlyOutDialog(true);
      return;
    }

    try {
      // Prepare update data
      const updateData: any = { status: newStatus };
      
      // If status is changed to absent, clear both check_in_time and check_out_time
      if (newStatus === 'absent') {
        updateData.check_in_time = null;
        updateData.check_out_time = null;
      }
      
      // If status is changed to no_checkout, clear check_out_time
      if (newStatus === 'no_checkout') {
        updateData.check_out_time = null;
      }
      
      const { error } = await supabase
        .from('attendance')
        .update(updateData)
        .eq('attendance_id', attendanceId);

      if (error) throw error;

      toast.success('Status updated successfully');
      fetchAttendanceData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const handlePresentSubmit = async () => {
    if (!checkInTime) {
      toast.error('Please enter check-in time');
      return;
    }

    try {
      // Create a timestamp from the time input
      const now = new Date();
      const [hours, minutes] = checkInTime.split(':');
      const checkInTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes));

      const { error } = await supabase
        .from('attendance')
        .update({ 
          status: 'present',
          check_in_time: checkInTimestamp.toISOString()
        })
        .eq('attendance_id', selectedAttendanceId);

      if (error) throw error;

      toast.success('Check-in time updated successfully');
      setShowPresentDialog(false);
      setCheckInTime('');
      setSelectedAttendanceId('');
      fetchAttendanceData();
    } catch (error) {
      console.error('Error updating check-in time:', error);
      toast.error('Failed to update check-in time');
    }
  };

  const handleLateSubmit = async () => {
    if (!lateCheckInTime) {
      toast.error('Please enter check-in time');
      return;
    }

    try {
      // Create a timestamp from the time input
      const now = new Date();
      const [hours, minutes] = lateCheckInTime.split(':');
      const checkInTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes));

      const { error } = await supabase
        .from('attendance')
        .update({ 
          status: 'late',
          check_in_time: checkInTimestamp.toISOString()
        })
        .eq('attendance_id', selectedAttendanceId);

      if (error) throw error;

      toast.success('Late check-in time updated successfully');
      setShowLateDialog(false);
      setLateCheckInTime('');
      setSelectedAttendanceId('');
      fetchAttendanceData();
    } catch (error) {
      console.error('Error updating late check-in time:', error);
      toast.error('Failed to update late check-in time');
    }
  };

  const handleEarlyOutSubmit = async () => {
    if (!earlyOutTime) {
      toast.error('Please enter check-out time');
      return;
    }

    try {
      // Create a timestamp from the time input
      const now = new Date();
      const [hours, minutes] = earlyOutTime.split(':');
      const checkOutTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), parseInt(hours), parseInt(minutes));

      const { error } = await supabase
        .from('attendance')
        .update({ 
          status: 'early_out',
          check_out_time: checkOutTimestamp.toISOString()
        })
        .eq('attendance_id', selectedAttendanceId);

      if (error) throw error;

      toast.success('Early out time updated successfully');
      setShowEarlyOutDialog(false);
      setEarlyOutTime('');
      setSelectedAttendanceId('');
      fetchAttendanceData();
    } catch (error) {
      console.error('Error updating early out time:', error);
      toast.error('Failed to update early out time');
    }
  };

  const clearFilters = () => {
    setUserSearchQuery('');
    setCreatedAtStartDate(undefined);
    setCreatedAtEndDate(undefined);
    setCheckInStartTime('');
    setCheckInEndTime('');
    setCheckOutStartTime('');
    setCheckOutEndTime('');
    setStatusFilter('all');
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    
    // Add title
    doc.setFontSize(18);
    doc.text('Attendance Report', 14, 20);
    
    // Add date
    doc.setFontSize(11);
    doc.text(`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`, 14, 28);
    
    // Add filters info
    const deptName = departments.find(d => d.department_id === selectedDepartment)?.department_name || 'All';
    const groupName = selectedGroup === 'all' ? 'All Groups' : groups.find(g => g.group_id === selectedGroup)?.group_name || 'All';
    doc.text(`Department: ${deptName} | Group: ${groupName}`, 14, 35);
    
    // Prepare table data using filtered data
    const tableData = filteredData.map(data => [
      getUserName(data.user),
      data.attendance?.check_in_time ? format(new Date(data.attendance.check_in_time), 'MMM dd, yyyy HH:mm') : '-',
      data.attendance?.check_out_time ? format(new Date(data.attendance.check_out_time), 'MMM dd, yyyy HH:mm') : '-',
      data.attendance?.status || 'absent'
    ]);
    
    // Add table
    autoTable(doc, {
      head: [['User', 'Check In', 'Check Out', 'Status']],
      body: tableData,
      startY: 42,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });
    
    // Save PDF
    doc.save(`attendance-report-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
    toast.success('PDF report generated successfully');
  };

  const generateExcel = () => {
    // Prepare data
    const deptName = departments.find(d => d.department_id === selectedDepartment)?.department_name || 'All';
    const groupName = selectedGroup === 'all' ? 'All Groups' : groups.find(g => g.group_id === selectedGroup)?.group_name || 'All';
    
    const excelData = filteredData.map(data => ({
      'User': getUserName(data.user),
      'Check In': data.attendance?.check_in_time ? format(new Date(data.attendance.check_in_time), 'MMM dd, yyyy HH:mm') : '-',
      'Check Out': data.attendance?.check_out_time ? format(new Date(data.attendance.check_out_time), 'MMM dd, yyyy HH:mm') : '-',
      'Status': data.attendance?.status || 'absent'
    }));
    
    // Add header info
    const headerData = [
      ['Attendance Report'],
      [`Generated: ${format(new Date(), 'MMM dd, yyyy HH:mm')}`],
      [`Department: ${deptName} | Group: ${groupName}`],
      [] // Empty row
    ];
    
    // Create worksheet
    const ws = XLSX.utils.aoa_to_sheet(headerData);
    XLSX.utils.sheet_add_json(ws, excelData, { origin: 'A5' });
    
    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Attendance');
    
    // Save file
    XLSX.writeFile(wb, `attendance-report-${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    toast.success('Excel report generated successfully');
  };

  return (
    <DashboardLayout>
      {/* Present Dialog */}
      <Dialog open={showPresentDialog} onOpenChange={setShowPresentDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Check-In Time</DialogTitle>
            <DialogDescription>Enter the check-in time for this attendance record.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="check-in-time">Check-In Time</Label>
            <Input
              id="check-in-time"
              type="time"
              value={checkInTime}
              onChange={(e) => setCheckInTime(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowPresentDialog(false);
              setCheckInTime('');
              setSelectedAttendanceId('');
            }}>
              Cancel
            </Button>
            <Button onClick={handlePresentSubmit}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Late Dialog */}
      <Dialog open={showLateDialog} onOpenChange={setShowLateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Late Check-In Time</DialogTitle>
            <DialogDescription>Enter the late check-in time for this attendance record.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="late-check-in-time">Check-In Time</Label>
            <Input
              id="late-check-in-time"
              type="time"
              value={lateCheckInTime}
              onChange={(e) => setLateCheckInTime(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowLateDialog(false);
              setLateCheckInTime('');
              setSelectedAttendanceId('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleLateSubmit}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Early Out Dialog */}
      <Dialog open={showEarlyOutDialog} onOpenChange={setShowEarlyOutDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Set Early Check-Out Time</DialogTitle>
            <DialogDescription>Enter the early check-out time for this attendance record.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="early-out-time">Check-Out Time</Label>
            <Input
              id="early-out-time"
              type="time"
              value={earlyOutTime}
              onChange={(e) => setEarlyOutTime(e.target.value)}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowEarlyOutDialog(false);
              setEarlyOutTime('');
              setSelectedAttendanceId('');
            }}>
              Cancel
            </Button>
            <Button onClick={handleEarlyOutSubmit}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Attendance Management</h1>
          <p className="text-muted-foreground mt-2">View and manage attendance records</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Attendance Records</CardTitle>
              <div className="flex gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                      <FileDown className="h-4 w-4 mr-2" />
                      Generate Report
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={generatePDF}>
                      Download as PDF
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={generateExcel}>
                      Download as Excel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <div className="space-y-4 mt-4">
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Department</label>
                  <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.department_id} value={dept.department_id}>
                          {dept.department_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Group</label>
                  <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select group" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Groups</SelectItem>
                      {groups.map((group) => (
                        <SelectItem key={group.group_id} value={group.group_id}>
                          {group.group_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Filters Section */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium">Filters</h3>
                  <Button variant="ghost" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Clear Filters
                  </Button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Search User</label>
                    <Input
                      placeholder="Search by name..."
                      value={userSearchQuery}
                      onChange={(e) => setUserSearchQuery(e.target.value)}
                    />
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium mb-2 block">Status</label>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="All Statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Statuses</SelectItem>
                        <SelectItem value="present">Present</SelectItem>
                        <SelectItem value="late">Late</SelectItem>
                        <SelectItem value="early_out">Early Out</SelectItem>
                        <SelectItem value="no_checkout">No Checkout</SelectItem>
                        <SelectItem value="absent">Absent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Check-In Time Range</label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={checkInStartTime}
                        onChange={(e) => setCheckInStartTime(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="time"
                        value={checkInEndTime}
                        onChange={(e) => setCheckInEndTime(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Check-Out Time Range</label>
                    <div className="flex gap-2">
                      <Input
                        type="time"
                        value={checkOutStartTime}
                        onChange={(e) => setCheckOutStartTime(e.target.value)}
                        className="flex-1"
                      />
                      <Input
                        type="time"
                        value={checkOutEndTime}
                        onChange={(e) => setCheckOutEndTime(e.target.value)}
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Created At Date Range</label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !createdAtStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {createdAtStartDate ? format(createdAtStartDate, "PPP") : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={createdAtStartDate}
                            onSelect={setCreatedAtStartDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !createdAtEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {createdAtEndDate ? format(createdAtEndDate, "PPP") : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={createdAtEndDate}
                            onSelect={setCreatedAtEndDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {attendanceData.length === 0 ? 'No attendance records found' : 'No results match the current filters'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((data) => (
                      <TableRow key={data.attendance?.attendance_id || data.user.user_id}>
                        <TableCell className="font-medium">
                          {getUserName(data.user)}
                        </TableCell>
                        <TableCell>
                          {data.attendance?.check_in_time
                            ? format(new Date(data.attendance.check_in_time), 'MMM dd, yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {data.attendance?.check_out_time
                            ? format(new Date(data.attendance.check_out_time), 'MMM dd, yyyy HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {data.attendance ? (
                            <Select
                              value={data.attendance.status}
                              onValueChange={(value) => handleStatusChange(data.attendance!.attendance_id, value as 'present' | 'late' | 'early_out' | 'no_checkout' | 'absent')}
                            >
                              <SelectTrigger className="w-[140px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="late">Late</SelectItem>
                                <SelectItem value="early_out">Early Out</SelectItem>
                                <SelectItem value="no_checkout">No Checkout</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            <Badge variant="destructive">Absent</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {data.attendance?.created_at
                            ? format(new Date(data.attendance.created_at), 'MMM dd, yyyy HH:mm')
                            : '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
