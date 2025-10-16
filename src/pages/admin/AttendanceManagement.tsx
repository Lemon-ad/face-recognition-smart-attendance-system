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
import { format } from 'date-fns';
import { toast } from 'sonner';
import { History, FileDown } from 'lucide-react';
import { AttendanceHistoryDialog } from '@/components/AttendanceHistoryDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  } | null;
  group: Group | null;
}

export default function AttendanceManagement() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [attendanceData, setAttendanceData] = useState<AttendanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);

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

      // Get today's date for attendance filtering
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString();

      // Fetch attendance records for today
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .gte('created_at', todayStr);

      if (attendanceError) throw attendanceError;

      // Fetch groups for start_time comparison
      const { data: groupsData, error: groupsError } = await supabase
        .from('group')
        .select('group_id, group_name, start_time, department_id');

      if (groupsError) throw groupsError;

      // Map users with their attendance
      const mappedData: AttendanceData[] = (users || []).map(user => {
        const userAttendance = attendanceRecords?.find(a => a.user_id === user.user_id);
        const userGroup = groupsData?.find(g => g.group_id === user.group_id);

        let status = 'absent';
        if (userAttendance) {
          // Trust the database status written by the edge function
          status = userAttendance.status || 'absent';
        }


        return {
          user,
          attendance: userAttendance ? {
            attendance_id: userAttendance.attendance_id,
            check_in_time: userAttendance.check_in_time,
            check_out_time: userAttendance.check_out_time,
            status,
            location: userAttendance.location,
          } : null,
          group: userGroup || null,
        };
      });

      setAttendanceData(mappedData);
    } catch (error) {
      console.error('Error fetching attendance data:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

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
    
    // Prepare table data
    const tableData = attendanceData.map(data => [
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
    
    const excelData = attendanceData.map(data => ({
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
                <Button
                  variant="outline"
                  onClick={() => setHistoryDialogOpen(true)}
                >
                  <History className="h-4 w-4 mr-2" />
                  View History
                </Button>
              </div>
            </div>
            <div className="flex gap-4 mt-4">
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
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No users found in selected department/group
                      </TableCell>
                    </TableRow>
                  ) : (
                    attendanceData.map((data) => (
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
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AttendanceHistoryDialog 
        open={historyDialogOpen} 
        onOpenChange={setHistoryDialogOpen}
      />
    </DashboardLayout>
  );
}
