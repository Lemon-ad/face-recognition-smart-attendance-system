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
  const [checkInStartDate, setCheckInStartDate] = useState<Date | undefined>();
  const [checkInEndDate, setCheckInEndDate] = useState<Date | undefined>();
  const [checkOutStartDate, setCheckOutStartDate] = useState<Date | undefined>();
  const [checkOutEndDate, setCheckOutEndDate] = useState<Date | undefined>();
  const [statusFilter, setStatusFilter] = useState<string>('all');

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

    // Filter by check-in date range
    if (checkInStartDate && checkInEndDate) {
      filtered = filtered.filter(data => {
        if (!data.attendance?.check_in_time) return false;
        const checkInDate = new Date(data.attendance.check_in_time);
        checkInDate.setHours(0, 0, 0, 0);
        const start = new Date(checkInStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(checkInEndDate);
        end.setHours(23, 59, 59, 999);
        return checkInDate >= start && checkInDate <= end;
      });
    }

    // Filter by check-out date range
    if (checkOutStartDate && checkOutEndDate) {
      filtered = filtered.filter(data => {
        if (!data.attendance?.check_out_time) return false;
        const checkOutDate = new Date(data.attendance.check_out_time);
        checkOutDate.setHours(0, 0, 0, 0);
        const start = new Date(checkOutStartDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(checkOutEndDate);
        end.setHours(23, 59, 59, 999);
        return checkOutDate >= start && checkOutDate <= end;
      });
    }

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(data => 
        data.attendance?.status === statusFilter || (!data.attendance && statusFilter === 'absent')
      );
    }

    setFilteredData(filtered);
  }, [attendanceData, userSearchQuery, checkInStartDate, checkInEndDate, checkOutStartDate, checkOutEndDate, statusFilter]);

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
    try {
      const { error } = await supabase
        .from('attendance')
        .update({ status: newStatus })
        .eq('attendance_id', attendanceId);

      if (error) throw error;

      toast.success('Status updated successfully');
      fetchAttendanceData();
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status');
    }
  };

  const clearFilters = () => {
    setUserSearchQuery('');
    setCheckInStartDate(undefined);
    setCheckInEndDate(undefined);
    setCheckOutStartDate(undefined);
    setCheckOutEndDate(undefined);
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
                    <label className="text-sm font-medium mb-2 block">Check-In Date Range</label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !checkInStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {checkInStartDate ? format(checkInStartDate, "PPP") : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={checkInStartDate}
                            onSelect={setCheckInStartDate}
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
                              !checkInEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {checkInEndDate ? format(checkInEndDate, "PPP") : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={checkInEndDate}
                            onSelect={setCheckInEndDate}
                            initialFocus
                            className={cn("p-3 pointer-events-auto")}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Check-Out Date Range</label>
                    <div className="flex gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "flex-1 justify-start text-left font-normal",
                              !checkOutStartDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {checkOutStartDate ? format(checkOutStartDate, "PPP") : "Start date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={checkOutStartDate}
                            onSelect={setCheckOutStartDate}
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
                              !checkOutEndDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {checkOutEndDate ? format(checkOutEndDate, "PPP") : "End date"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={checkOutEndDate}
                            onSelect={setCheckOutEndDate}
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
                      <TableRow key={data.user.user_id}>
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
