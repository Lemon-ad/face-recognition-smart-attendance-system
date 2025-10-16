import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, AlertCircle, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface Department {
  department_id: string;
  department_name: string;
}

interface Group {
  group_id: string;
  group_name: string;
  department_id: string;
}

interface AttendanceIssue {
  user_id: string;
  first_name: string;
  last_name: string;
  status: string;
  check_in_time: string;
  date: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--muted))'];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [totalUsers, setTotalUsers] = useState(0);
  const [presentToday, setPresentToday] = useState({ count: 0, percentage: 0 });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedDeptForGroup, setSelectedDeptForGroup] = useState<string>('all');
  const [departmentAttendance, setDepartmentAttendance] = useState<any[]>([]);
  const [groupAttendance, setGroupAttendance] = useState<any[]>([]);
  const [trendDepartment, setTrendDepartment] = useState<string>('all');
  const [trendGroup, setTrendGroup] = useState<string>('all');
  const [trendPeriod, setTrendPeriod] = useState<string>('week');
  const [trendData, setTrendData] = useState<any[]>([]);
  const [attendanceIssues, setAttendanceIssues] = useState<AttendanceIssue[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    fetchDepartmentAttendance();
  }, []);

  useEffect(() => {
    fetchGroupAttendance();
  }, [selectedDeptForGroup]);

  useEffect(() => {
    fetchTrendData();
  }, [trendDepartment, trendGroup, trendPeriod]);

  useEffect(() => {
    fetchAttendanceIssues();
  }, []);

  const fetchDashboardData = async () => {
    // Total users (excluding admin)
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'admin');
    setTotalUsers(userCount || 0);

    // Present today (including late, early_out, no_checkout)
    const today = new Date().toISOString().split('T')[0];
    const { data: attendanceData, count: presentCount } = await supabase
      .from('attendance')
      .select('*', { count: 'exact' })
      .gte('created_at', today)
      .lt('created_at', `${today}T23:59:59`)
      .in('status', ['present', 'late', 'early_out', 'no_checkout']);
    
    const percentage = userCount ? ((presentCount || 0) / userCount) * 100 : 0;
    setPresentToday({ count: presentCount || 0, percentage });

    // Fetch departments and groups
    const { data: depts } = await supabase.from('department').select('department_id, department_name');
    setDepartments(depts || []);

    const { data: grps } = await supabase.from('group').select('group_id, group_name, department_id');
    setGroups(grps || []);
  };

  const fetchDepartmentAttendance = async () => {
    const today = new Date().toISOString().split('T')[0];
    const { data: depts } = await supabase.from('department').select('department_id, department_name');
    
    if (!depts) return;

    const deptData = await Promise.all(
      depts.map(async (dept) => {
        const { count: presentCount } = await supabase
          .from('attendance')
          .select('*, users!inner(*)', { count: 'exact', head: true })
          .eq('users.department_id', dept.department_id)
          .gte('created_at', today)
          .lt('created_at', `${today}T23:59:59`)
          .in('status', ['present', 'late', 'early_out', 'no_checkout']);

        const { count: totalCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('department_id', dept.department_id)
          .neq('role', 'admin');

        return {
          name: dept.department_name,
          value: presentCount || 0,
          total: totalCount || 0
        };
      })
    );

    setDepartmentAttendance(deptData);
  };

  const fetchGroupAttendance = async () => {
    const today = new Date().toISOString().split('T')[0];
    let groupsToFetch = groups;

    if (selectedDeptForGroup !== 'all') {
      groupsToFetch = groups.filter(g => g.department_id === selectedDeptForGroup);
    }

    const groupData = await Promise.all(
      groupsToFetch.map(async (group) => {
        const { count: presentCount } = await supabase
          .from('attendance')
          .select('*, users!inner(*)', { count: 'exact', head: true })
          .eq('users.group_id', group.group_id)
          .gte('created_at', today)
          .lt('created_at', `${today}T23:59:59`)
          .in('status', ['present', 'late', 'early_out', 'no_checkout']);

        const { count: totalCount } = await supabase
          .from('users')
          .select('*', { count: 'exact', head: true })
          .eq('group_id', group.group_id)
          .neq('role', 'admin');

        return {
          name: group.group_name,
          value: presentCount || 0,
          total: totalCount || 0
        };
      })
    );

    setGroupAttendance(groupData);
  };

  const fetchTrendData = async () => {
    const now = new Date();
    let startDate = new Date();
    let dateFormat: Intl.DateTimeFormatOptions = {};

    switch (trendPeriod) {
      case 'week':
        startDate.setDate(now.getDate() - 7);
        dateFormat = { month: 'short', day: 'numeric' };
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        dateFormat = { month: 'short', day: 'numeric' };
        break;
      case 'annual':
        startDate.setFullYear(now.getFullYear() - 1);
        dateFormat = { year: 'numeric', month: 'short' };
        break;
    }

    let query = supabase
      .from('attendance')
      .select('created_at, status, users!inner(department_id, group_id)')
      .gte('created_at', startDate.toISOString())
      .in('status', ['present', 'late', 'early_out', 'no_checkout']);

    if (trendDepartment !== 'all') {
      query = query.eq('users.department_id', trendDepartment);
    }

    if (trendGroup !== 'all') {
      query = query.eq('users.group_id', trendGroup);
    }

    const { data } = await query;

    if (!data) {
      setTrendData([]);
      return;
    }

    // Group by date
    const dateGroups: { [key: string]: number } = {};
    data.forEach((record) => {
      const date = new Date(record.created_at).toLocaleDateString('en-US', dateFormat);
      dateGroups[date] = (dateGroups[date] || 0) + 1;
    });

    const chartData = Object.entries(dateGroups).map(([date, count]) => ({
      date,
      attendance: count
    }));

    setTrendData(chartData);
  };

  const fetchAttendanceIssues = async () => {
    const now = new Date();
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
    weekStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from('attendance')
      .select('user_id, check_in_time, created_at, status, users!inner(first_name, last_name)')
      .gte('created_at', weekStart.toISOString())
      .in('status', ['late', 'absent', 'early_out', 'no_checkout'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      const issues = data.map((record: any) => ({
        user_id: record.user_id,
        first_name: record.users.first_name,
        last_name: record.users.last_name,
        status: record.status,
        check_in_time: record.check_in_time,
        date: new Date(record.created_at).toLocaleDateString()
      }));
      setAttendanceIssues(issues);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'late':
        return 'secondary';
      case 'absent':
        return 'destructive';
      case 'early_out':
      case 'no_checkout':
        return 'outline';
      default:
        return 'default';
    }
  };

  const filteredGroups = trendDepartment === 'all' 
    ? groups 
    : groups.filter(g => g.department_id === trendDepartment);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Welcome back! Here's an overview of the system.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/admin/users')}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Users
              </CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalUsers}</div>
              <p className="text-xs text-muted-foreground mt-1">
                Active members in system
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Present Today
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{presentToday.count}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {presentToday.percentage.toFixed(1)}% attendance rate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Department and Group Attendance */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Department Attendance</CardTitle>
            </CardHeader>
            <CardContent>
              {departmentAttendance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentAttendance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, total }) => `${name}: ${value}/${total}`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {departmentAttendance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Group Attendance</span>
                <Select value={selectedDeptForGroup} onValueChange={setSelectedDeptForGroup}>
                  <SelectTrigger className="w-[200px]">
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
              </CardTitle>
            </CardHeader>
            <CardContent>
              {groupAttendance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={groupAttendance}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value, total }) => `${name}: ${value}/${total}`}
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {groupAttendance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendance Trend */}
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-4 justify-between">
              <span>Attendance Trend</span>
              <div className="flex flex-wrap gap-2">
                <Select value={trendDepartment} onValueChange={setTrendDepartment}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Department" />
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

                <Select value={trendGroup} onValueChange={setTrendGroup}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="Group" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Groups</SelectItem>
                    {filteredGroups.map((group) => (
                      <SelectItem key={group.group_id} value={group.group_id}>
                        {group.group_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={trendPeriod} onValueChange={setTrendPeriod}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendData.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                  <YAxis stroke="hsl(var(--muted-foreground))" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="attendance" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--primary))' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">No data available</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Attendance Issues */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              Recent Attendance Issues (This Week)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceIssues.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceIssues.map((issue, index) => (
                    <TableRow key={index}>
                      <TableCell className="font-medium">
                        {issue.first_name} {issue.last_name}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(issue.status)}>
                          {issue.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell>{issue.check_in_time || 'N/A'}</TableCell>
                      <TableCell>{issue.date}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No attendance issues this week
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
