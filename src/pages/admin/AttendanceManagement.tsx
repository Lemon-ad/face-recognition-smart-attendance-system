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
import { format } from 'date-fns';
import { toast } from 'sonner';

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

  useEffect(() => {
    fetchDepartments();
  }, []);

  useEffect(() => {
    if (selectedDepartment) {
      fetchGroups();
      fetchAttendanceData();
    }
  }, [selectedDepartment, selectedGroup]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('department')
        .select('department_id, department_name')
        .order('department_name');

      if (error) throw error;
      setDepartments(data || []);
      setSelectedDepartment('all');
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast.error('Failed to load departments');
    }
  };

  const fetchGroups = async () => {
    try {
      let query = supabase
        .from('group')
        .select('group_id, group_name, start_time, department_id');
      
      if (selectedDepartment !== 'all') {
        query = query.eq('department_id', selectedDepartment);
      }
      
      const { data, error } = await query.order('group_name');

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
        .select('user_id, first_name, last_name, username, group_id, department_id');
      
      if (selectedDepartment !== 'all') {
        usersQuery = usersQuery.eq('department_id', selectedDepartment);
      }

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
        if (userAttendance?.check_in_time) {
          if (userGroup?.start_time) {
            const checkInTime = new Date(userAttendance.check_in_time);
            const [hours, minutes] = userGroup.start_time.split(':').map(Number);
            const startTime = new Date(checkInTime);
            startTime.setHours(hours, minutes, 0, 0);

            status = checkInTime > startTime ? 'late' : 'present';
          } else {
            status = 'present';
          }
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
        return 'default';
      case 'late':
        return 'secondary';
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

  return (
    <DashboardLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Attendance Management</h1>
          <p className="text-muted-foreground mt-2">View and manage attendance records</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Attendance Records</CardTitle>
            <div className="flex gap-4 mt-4">
              <div className="flex-1">
                <label className="text-sm font-medium mb-2 block">Department</label>
                <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select department" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
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
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
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
                          <Badge variant={getStatusBadgeVariant(data.attendance?.status || 'absent')}>
                            {data.attendance?.status || 'absent'}
                          </Badge>
                        </TableCell>
                        <TableCell>{data.attendance?.location || '-'}</TableCell>
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
