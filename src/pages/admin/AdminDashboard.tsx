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
  const [deptAttendancePeriod, setDeptAttendancePeriod] = useState<string>('day');
  const [groupAttendancePeriod, setGroupAttendancePeriod] = useState<string>('day');
  const [trendDepartment, setTrendDepartment] = useState<string>('all');
  const [trendGroup, setTrendGroup] = useState<string>('all');
  const [trendPeriod, setTrendPeriod] = useState<string>('week');
  const [totalUsersForTrend, setTotalUsersForTrend] = useState(0);
  const [trendData, setTrendData] = useState<any[]>([]);
  const [attendanceIssues, setAttendanceIssues] = useState<AttendanceIssue[]>([]);

  useEffect(() => {
    fetchDashboardData();
    
    // Set up real-time subscription for attendance changes
    const channel = supabase
      .channel('attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to all changes (INSERT, UPDATE, DELETE)
          schema: 'public',
          table: 'attendance'
        },
        () => {
          // Refresh dashboard data when attendance changes
          fetchDashboardData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    fetchDepartmentAttendance();
  }, [deptAttendancePeriod]);

  useEffect(() => {
    if (groups.length > 0) {
      fetchGroupAttendance();
    }
  }, [selectedDeptForGroup, groupAttendancePeriod, groups]);

  useEffect(() => {
    fetchTrendData();
  }, [trendDepartment, trendGroup, trendPeriod]);

  useEffect(() => {
    fetchAttendanceIssues();
  }, []);

  // Check if record is within date range (created_at is in KL time)
  const isWithinPeriod = (createdAtStr: string, period: string) => {
    // Parse the date - it's already in KL time
    const createdAt = new Date(createdAtStr);
    
    // Get current KL time
    const now = new Date();
    const klTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    
    let daysBack = 1;
    switch (period) {
      case 'day':
        daysBack = 1;
        break;
      case 'week':
        daysBack = 7;
        break;
      case 'month':
        daysBack = 30;
        break;
      case 'annual':
        daysBack = 365;
        break;
    }
    
    const cutoffDate = new Date(klTime);
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    cutoffDate.setHours(0, 0, 0, 0);
    
    return createdAt >= cutoffDate;
  };

  // Compare dates (created_at is already in KL time from database)
  const isSameDate = (createdAtStr: string) => {
    // Parse the date string - it's already in KL time format
    const createdAt = new Date(createdAtStr);
    
    // Extract just the date portion from created_at (YYYY-MM-DD)
    const recordDate = createdAtStr.split('T')[0];
    
    // Get today's date in KL time
    const now = new Date();
    const klTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
    const todayYear = klTime.getFullYear();
    const todayMonth = String(klTime.getMonth() + 1).padStart(2, '0');
    const todayDay = String(klTime.getDate()).padStart(2, '0');
    const todayDate = `${todayYear}-${todayMonth}-${todayDay}`;
    
    console.log(`isSameDate: recordDate=${recordDate}, todayDate=${todayDate}, match=${recordDate === todayDate}`);
    
    return recordDate === todayDate;
  };

  const fetchDashboardData = async () => {
    // Total users (excluding admin)
    const { count: userCount } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'admin');
    const totalUserCount = userCount || 0;
    setTotalUsers(totalUserCount);

    // Get all attendance records
    const { data: allAttendance } = await supabase
      .from('attendance')
      .select('*');
    
    console.log('All attendance records:', allAttendance);
    
    // Filter by today (using isSameDate to check if created_at date matches today's date)
    const todayAttendance = allAttendance?.filter(record => 
      isSameDate(record.created_at)
    ) || [];
    
    console.log('Today attendance:', todayAttendance);
    
    // Calculate attendance rate: users who checked in today / total users
    const withCheckIn = todayAttendance.filter(record => record.check_in_time !== null).length;
    const percentage = totalUserCount > 0 ? (withCheckIn / totalUserCount) * 100 : 0;
    
    console.log(`Present today: ${withCheckIn}/${totalUserCount} = ${percentage}%`);
    
    setPresentToday({ count: withCheckIn, percentage });

    // Fetch departments and groups
    const { data: depts } = await supabase.from('department').select('department_id, department_name');
    setDepartments(depts || []);

    const { data: grps } = await supabase.from('group').select('group_id, group_name, department_id');
    setGroups(grps || []);
  };

  const fetchDepartmentAttendance = async () => {
    const { data: depts } = await supabase.from('department').select('department_id, department_name');
    
    if (!depts) return;

    const deptData = await Promise.all(
      depts.map(async (dept) => {
        // Get all attendance for this department
        const { data: allAttendance } = await supabase
          .from('attendance')
          .select('*, users!inner(*)')
          .eq('users.department_id', dept.department_id);

        // Filter by period
        const periodAttendance = allAttendance?.filter(record => 
          isWithinPeriod(record.created_at, deptAttendancePeriod)
        ) || [];

        // Calculate attendance rate: with check_in_time / total created in period
        const withCheckIn = periodAttendance.filter(record => record.check_in_time !== null).length;
        const totalInPeriod = periodAttendance.length;
        const rate = totalInPeriod > 0 ? (withCheckIn / totalInPeriod) * 100 : 0;

        return {
          name: dept.department_name,
          value: rate,
          count: withCheckIn,
          total: totalInPeriod
        };
      })
    );

    setDepartmentAttendance(deptData);
  };

  const fetchGroupAttendance = async () => {
    // Always show all groups across all departments by default
    let groupsToFetch = groups;

    if (selectedDeptForGroup !== 'all') {
      groupsToFetch = groups.filter(g => g.department_id === selectedDeptForGroup);
    }

    const groupData = await Promise.all(
      groupsToFetch.map(async (group) => {
        // Get all attendance for this group
        const { data: allAttendance } = await supabase
          .from('attendance')
          .select('*, users!inner(*)')
          .eq('users.group_id', group.group_id);

        // Filter by period
        const periodAttendance = allAttendance?.filter(record => 
          isWithinPeriod(record.created_at, groupAttendancePeriod)
        ) || [];

        // Calculate attendance rate: with check_in_time / total created in period
        const withCheckIn = periodAttendance.filter(record => record.check_in_time !== null).length;
        const totalInPeriod = periodAttendance.length;
        const rate = totalInPeriod > 0 ? (withCheckIn / totalInPeriod) * 100 : 0;

        return {
          name: group.group_name,
          value: rate,
          count: withCheckIn,
          total: totalInPeriod
        };
      })
    );

    setGroupAttendance(groupData);
  };

  const fetchTrendData = async () => {
    const now = new Date();
    const klTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));

    // Get total users count for percentage calculation
    let userCountQuery = supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .neq('role', 'admin');

    if (trendDepartment !== 'all') {
      userCountQuery = userCountQuery.eq('department_id', trendDepartment);
    }

    if (trendGroup !== 'all') {
      userCountQuery = userCountQuery.eq('group_id', trendGroup);
    }

    const { count: userCount } = await userCountQuery;
    const totalUsers = userCount || 0;
    setTotalUsersForTrend(totalUsers);

    if (totalUsers === 0) {
      setTrendData([]);
      return;
    }

    // Fetch all attendance records with check_in_time
    let query = supabase
      .from('attendance')
      .select('created_at, check_in_time, users!inner(department_id, group_id)')
      .not('check_in_time', 'is', null);

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

    let chartData: any[] = [];

    if (trendPeriod === 'week') {
      // Week view: Show each day (Sun-Sat) of current week
      const startOfWeek = new Date(klTime);
      startOfWeek.setDate(klTime.getDate() - klTime.getDay()); // Go to Sunday
      startOfWeek.setHours(0, 0, 0, 0);

      const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dailyData: { [key: string]: { count: number, sortDate: Date } } = {};

      // Initialize all days of the week
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        const dayKey = day.toISOString().split('T')[0];
        dailyData[dayKey] = { count: 0, sortDate: day };
      }

      // Count attendance for each day
      data.forEach((record) => {
        const recordDate = record.created_at.split('T')[0];
        if (dailyData[recordDate]) {
          dailyData[recordDate].count++;
        }
      });

      chartData = Object.entries(dailyData)
        .map(([dateKey, data]) => {
          const dayOfWeek = data.sortDate.getDay();
          const percentage = totalUsers > 0 ? (data.count / totalUsers) * 100 : 0;
          return {
            date: dayNames[dayOfWeek],
            attendance: percentage,
            sortDate: data.sortDate
          };
        })
        .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
        .map(({ date, attendance }) => ({ date, attendance }));

    } else if (trendPeriod === 'month') {
      // Month view: Show weekly averages
      const startOfMonth = new Date(klTime.getFullYear(), klTime.getMonth(), 1);
      const endOfMonth = new Date(klTime.getFullYear(), klTime.getMonth() + 1, 0);

      const weeklyData: { [key: string]: { count: number, days: number, sortDate: Date } } = {};

      // Group by week number
      data.forEach((record) => {
        const recordDate = new Date(record.created_at);
        if (recordDate >= startOfMonth && recordDate <= endOfMonth) {
          const weekStart = new Date(recordDate);
          weekStart.setDate(recordDate.getDate() - recordDate.getDay());
          const weekKey = weekStart.toISOString().split('T')[0];
          
          if (!weeklyData[weekKey]) {
            weeklyData[weekKey] = { count: 0, days: 0, sortDate: weekStart };
          }
          weeklyData[weekKey].count++;
        }
      });

      // Calculate days in each week
      Object.keys(weeklyData).forEach(weekKey => {
        const weekStart = new Date(weekKey);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        
        let daysInWeek = 0;
        for (let d = new Date(weekStart); d <= weekEnd && d <= endOfMonth; d.setDate(d.getDate() + 1)) {
          if (d >= startOfMonth) daysInWeek++;
        }
        weeklyData[weekKey].days = daysInWeek;
      });

      chartData = Object.entries(weeklyData)
        .map(([weekKey, data], index) => {
          const totalDays = data.days * totalUsers;
          const percentage = totalDays > 0 ? (data.count / totalDays) * 100 : 0;
          return {
            date: `Week ${index + 1}`,
            attendance: percentage,
            sortDate: data.sortDate
          };
        })
        .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
        .map(({ date, attendance }) => ({ date, attendance }));

    } else if (trendPeriod === 'annual') {
      // Annual view: Show monthly averages
      const currentYear = klTime.getFullYear();
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const monthlyData: { [key: number]: { count: number, days: number } } = {};

      // Initialize all months
      for (let i = 0; i < 12; i++) {
        monthlyData[i] = { count: 0, days: new Date(currentYear, i + 1, 0).getDate() };
      }

      // Count attendance for each month
      data.forEach((record) => {
        const recordDate = new Date(record.created_at);
        if (recordDate.getFullYear() === currentYear) {
          const month = recordDate.getMonth();
          monthlyData[month].count++;
        }
      });

      chartData = Object.entries(monthlyData)
        .map(([monthIndex, data]) => {
          const totalDays = data.days * totalUsers;
          const percentage = totalDays > 0 ? (data.count / totalDays) * 100 : 0;
          return {
            date: monthNames[parseInt(monthIndex)],
            attendance: percentage
          };
        });

    } else if (trendPeriod === 'decade') {
      // Decade view: Show yearly averages for 10 years
      const currentYear = klTime.getFullYear();
      const yearlyData: { [key: number]: { count: number, days: number } } = {};

      // Initialize 10 years
      for (let i = 0; i < 10; i++) {
        const year = currentYear - 9 + i;
        const isLeapYear = (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
        yearlyData[year] = { count: 0, days: isLeapYear ? 366 : 365 };
      }

      // Count attendance for each year
      data.forEach((record) => {
        const recordDate = new Date(record.created_at);
        const year = recordDate.getFullYear();
        if (yearlyData[year]) {
          yearlyData[year].count++;
        }
      });

      chartData = Object.entries(yearlyData)
        .map(([year, data]) => {
          const totalDays = data.days * totalUsers;
          const percentage = totalDays > 0 ? (data.count / totalDays) * 100 : 0;
          return {
            date: year,
            attendance: percentage
          };
        });
    }

    setTrendData(chartData);
  };

  const fetchAttendanceIssues = async () => {
    const now = new Date();
    const malaysiaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const daysBack = 7;

    const { data } = await supabase
      .from('attendance')
      .select('user_id, check_in_time, created_at, status, users!inner(first_name, last_name)')
      .in('status', ['late', 'absent', 'early_out', 'no_checkout'])
      .order('created_at', { ascending: false })
      .limit(50); // Get more records to filter

    if (data) {
      const cutoffDate = new Date(malaysiaTime.getTime() - daysBack * 24 * 60 * 60 * 1000);
      
      const issues = data
        .filter(record => {
          const createdAt = new Date(record.created_at);
          return createdAt >= cutoffDate;
        })
        .slice(0, 10) // Take only top 10 after filtering
        .map((record: any) => {
          const createdAt = new Date(record.created_at);
          return {
            user_id: record.user_id,
            first_name: record.users.first_name,
            last_name: record.users.last_name,
            status: record.status,
            check_in_time: record.check_in_time,
            date: createdAt.toLocaleDateString('en-MY')
          };
        });
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

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/admin/attendance')}
          >
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
          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/admin/attendance')}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Department Attendance</span>
                <Select value={deptAttendancePeriod} onValueChange={setDeptAttendancePeriod}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="day">Day</SelectItem>
                    <SelectItem value="week">Week</SelectItem>
                    <SelectItem value="month">Month</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {departmentAttendance.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={departmentAttendance}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {departmentAttendance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(1)}% (${props.payload.count}/${props.payload.total})`,
                      'Attendance Rate'
                    ]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data available</p>
              )}
            </CardContent>
          </Card>

          <Card 
            className="cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => navigate('/admin/attendance')}
          >
            <CardHeader>
              <CardTitle className="flex flex-wrap items-center gap-2 justify-between">
                <span>Group Attendance</span>
                <div className="flex gap-2">
                  <Select value={selectedDeptForGroup} onValueChange={setSelectedDeptForGroup}>
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
                  <Select value={groupAttendancePeriod} onValueChange={setGroupAttendancePeriod}>
                    <SelectTrigger className="w-[120px]">
                      <SelectValue placeholder="Period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">Day</SelectItem>
                      <SelectItem value="week">Week</SelectItem>
                      <SelectItem value="month">Month</SelectItem>
                      <SelectItem value="annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
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
                      outerRadius={80}
                      fill="hsl(var(--primary))"
                      dataKey="value"
                    >
                      {groupAttendance.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Legend />
                    <Tooltip formatter={(value: number, name: string, props: any) => [
                      `${value.toFixed(1)}% (${props.payload.count}/${props.payload.total})`,
                      'Attendance Rate'
                    ]} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-muted-foreground text-center py-8">No data available</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Attendance Trend */}
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin/attendance')}
        >
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
                    <SelectItem value="decade">Decade</SelectItem>
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
                  <YAxis 
                    stroke="hsl(var(--muted-foreground))" 
                    label={{ value: 'Attendance %', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))'
                    }}
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Attendance']}
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
        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/admin/attendance')}
        >
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
