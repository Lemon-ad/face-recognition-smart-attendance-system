import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ClipboardCheck, Clock, Calendar, AlertCircle, TrendingUp } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo, useEffect } from 'react';
import { format, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, isToday, parseISO } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

type Period = 'week' | 'month' | 'annual';

export default function MemberDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [attendancePeriod, setAttendancePeriod] = useState<Period>('month');
  const [trendPeriod, setTrendPeriod] = useState<Period>('month');

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('users')
        .select('*, department(*), group(*)')
        .eq('auth_uuid', user?.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: attendanceRecords = [] } = useQuery({
    queryKey: ['member-attendance', userProfile?.user_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userProfile?.user_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!userProfile?.user_id,
  });

  // Set up real-time subscription for attendance changes
  useEffect(() => {
    if (!userProfile?.user_id) return;

    const channel = supabase
      .channel('member-attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance',
          filter: `user_id=eq.${userProfile.user_id}`
        },
        () => {
          // Refresh attendance data when any change occurs for this user
          queryClient.invalidateQueries({ queryKey: ['member-attendance', userProfile.user_id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userProfile?.user_id, queryClient]);

  const getPeriodDates = (period: Period) => {
    const now = new Date();
    let start, end;
    
    switch (period) {
      case 'week':
        start = startOfWeek(now, { weekStartsOn: 1 });
        end = endOfWeek(now, { weekStartsOn: 1 });
        break;
      case 'month':
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case 'annual':
        start = startOfYear(now);
        end = endOfYear(now);
        break;
    }
    
    return { start, end };
  };

  const stats = useMemo(() => {
    if (!attendanceRecords.length) {
      return {
        todayStatus: 'No Record',
        todayStatusBadge: 'secondary' as const,
        attendancePercentage: 0,
        onTimeRate: 0,
        totalDays: 0,
        issuesPercentage: 0,
      };
    }

    const { start, end } = getPeriodDates(attendancePeriod);
    const periodRecords = attendanceRecords.filter(record => {
      const recordDate = new Date(record.created_at);
      return recordDate >= start && recordDate <= end;
    });

    const todayRecord = attendanceRecords.find(record => 
      isToday(new Date(record.created_at))
    );

    const getStatusBadge = (status: string) => {
      switch (status) {
        case 'present': return 'default';
        case 'late': return 'warning';
        case 'absent': return 'destructive';
        default: return 'secondary';
      }
    };

    const presentCount = periodRecords.filter(r => 
      r.check_in_time !== null
    ).length;
    
    const onTimeCount = periodRecords.filter(r => r.status === 'present').length;
    
    const workingDays = Math.max(periodRecords.length, 1);
    const attendancePercentage = Math.round((presentCount / workingDays) * 100);
    const onTimeRate = presentCount > 0 ? Math.round((onTimeCount / presentCount) * 100) : 0;

    // Calculate issues percentage
    const issuesCount = periodRecords.filter(r => 
      ['late', 'absent', 'early_out', 'no_checkout'].includes(r.status)
    ).length;
    const issuesPercentage = workingDays > 0 ? Math.round((issuesCount / workingDays) * 100) : 0;

    return {
      todayStatus: todayRecord ? todayRecord.status : 'No Record',
      todayStatusBadge: todayRecord ? getStatusBadge(todayRecord.status) : 'secondary' as const,
      attendancePercentage: isNaN(attendancePercentage) ? 0 : attendancePercentage,
      onTimeRate: isNaN(onTimeRate) ? 0 : onTimeRate,
      totalDays: presentCount,
      issuesPercentage,
    };
  }, [attendanceRecords, attendancePeriod]);

  const attendanceIssues = useMemo(() => {
    return attendanceRecords
      .filter(record => ['late', 'absent', 'early_out', 'no_checkout'].includes(record.status))
      .slice(0, 10);
  }, [attendanceRecords]);

  const chartData = useMemo(() => {
    const { start, end } = getPeriodDates(trendPeriod);
    const periodRecords = attendanceRecords.filter(record => {
      const recordDate = new Date(record.created_at);
      return recordDate >= start && recordDate <= end;
    });

    const groupedByDate: Record<string, { attended: number, date: Date }> = {};
    
    periodRecords.forEach(record => {
      const recordDate = new Date(record.created_at);
      const dateKey = format(recordDate, 'MMM dd');
      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = { attended: 0, date: recordDate };
      }
      
      // Count any record with check_in_time as present
      if (record.check_in_time !== null) {
        groupedByDate[dateKey].attended++;
      }
    });

    return Object.entries(groupedByDate)
      .map(([dateKey, counts]) => ({
        date: dateKey,
        attendance: counts.attended,
        sortDate: counts.date,
      }))
      .sort((a, b) => a.sortDate.getTime() - b.sortDate.getTime())
      .slice(-14);
  }, [attendanceRecords, trendPeriod]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'late':
        return <Badge variant="default" className="bg-yellow-500">Late</Badge>;
      case 'absent':
        return <Badge variant="destructive">Absent</Badge>;
      case 'early_out':
        return <Badge variant="default" className="bg-orange-500">Early Out</Badge>;
      case 'no_checkout':
        return <Badge variant="secondary">No Check Out</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Dashboard</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            View your attendance statistics and performance
          </p>
        </div>

        {/* Today's Status */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Attendance Status
            </CardTitle>
            <Calendar className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold capitalize">{stats.todayStatus}</div>
              <Badge variant={stats.todayStatusBadge as "default" | "destructive" | "outline" | "secondary"} className="capitalize">
                {stats.todayStatus}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
            </p>
          </CardContent>
        </Card>

        {/* Stats Grid with Period Selector */}
        <div>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
            <h2 className="text-lg font-semibold">Attendance Statistics</h2>
            <Select value={attendancePeriod} onValueChange={(v) => setAttendancePeriod(v as Period)}>
              <SelectTrigger className="w-full sm:w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="week">Week</SelectItem>
                <SelectItem value="month">Month</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Attendance Rate
                </CardTitle>
                <ClipboardCheck className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.attendancePercentage}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.totalDays} days present
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  On-Time Rate
                </CardTitle>
                <Clock className="h-4 w-4 text-accent" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.onTimeRate}%</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Punctuality score
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Issues
                </CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{attendanceIssues.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.issuesPercentage}% of total attendance
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Attendance Trend Chart */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Attendance Trend
              </CardTitle>
              <Select value={trendPeriod} onValueChange={(v) => setTrendPeriod(v as Period)}>
                <SelectTrigger className="w-full sm:w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="week">Week</SelectItem>
                  <SelectItem value="month">Month</SelectItem>
                  <SelectItem value="annual">Annual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {chartData.length > 0 ? (
              <ChartContainer
                config={{
                  attendance: {
                    label: 'Attendance',
                    color: 'hsl(var(--primary))',
                  },
                }}
                className="h-[300px]"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line 
                      type="monotone" 
                      dataKey="attendance" 
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No attendance data available for this period
              </p>
            )}
          </CardContent>
        </Card>

        {/* Attendance Issues History */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Issues History</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceIssues.length > 0 ? (
              <div className="overflow-x-auto -mx-4 sm:mx-0">
                <div className="inline-block min-w-full align-middle">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="whitespace-nowrap">Date</TableHead>
                        <TableHead className="whitespace-nowrap">Status</TableHead>
                        <TableHead className="whitespace-nowrap">Check In</TableHead>
                        <TableHead className="whitespace-nowrap">Check Out</TableHead>
                        <TableHead className="whitespace-nowrap">Location</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceIssues.map((record) => (
                        <TableRow key={record.attendance_id}>
                          <TableCell className="whitespace-nowrap">
                            {format(new Date(record.created_at), 'MMM dd, yyyy')}
                          </TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell className="whitespace-nowrap">
                            {record.check_in_time 
                              ? format(new Date(record.check_in_time), 'HH:mm')
                              : '-'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            {record.check_out_time 
                              ? format(new Date(record.check_out_time), 'HH:mm')
                              : '-'}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm whitespace-nowrap">
                            {record.location || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No attendance issues found - Great job!
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
