import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { CalendarIcon, X } from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

interface AttendanceRecord {
  attendance_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  location: string | null;
  created_at: string;
}

export default function MemberAttendance() {
  const { user } = useAuth();
  const [attendanceData, setAttendanceData] = useState<AttendanceRecord[]>([]);
  const [filteredData, setFilteredData] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Get today's date for default filter
  const getTodayMalaysiaTime = () => {
    const now = new Date();
    const malaysiaTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return new Date(malaysiaTime.getUTCFullYear(), malaysiaTime.getUTCMonth(), malaysiaTime.getUTCDate());
  };
  
  const [createdAtStartDate, setCreatedAtStartDate] = useState<Date | undefined>(getTodayMalaysiaTime());
  const [createdAtEndDate, setCreatedAtEndDate] = useState<Date | undefined>(getTodayMalaysiaTime());
  const [checkInStartTime, setCheckInStartTime] = useState('');
  const [checkInEndTime, setCheckInEndTime] = useState('');
  const [checkOutStartTime, setCheckOutStartTime] = useState('');
  const [checkOutEndTime, setCheckOutEndTime] = useState('');

  useEffect(() => {
    if (user) {
      fetchAttendanceData();
    }
  }, [user]);

  // Set up real-time subscription for attendance changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('member-attendance-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'attendance'
        },
        () => {
          fetchAttendanceData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const fetchAttendanceData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      
      // Get the current user's user_id from users table
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('user_id')
        .eq('auth_uuid', user.id)
        .single();

      if (userError) throw userError;

      // Fetch attendance records for current user
      const { data: attendanceRecords, error: attendanceError } = await supabase
        .from('attendance')
        .select('*')
        .eq('user_id', userData.user_id)
        .order('created_at', { ascending: false });

      if (attendanceError) throw attendanceError;

      setAttendanceData(attendanceRecords || []);
      setFilteredData(attendanceRecords || []);
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

    // Filter by created_at date range
    if (createdAtStartDate && createdAtEndDate) {
      filtered = filtered.filter(record => {
        if (!record.created_at) return false;
        const createdDate = new Date(record.created_at);
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
      filtered = filtered.filter(record => {
        if (!record.check_in_time) return false;
        const checkInDate = new Date(record.check_in_time);
        const timeString = format(checkInDate, 'HH:mm');
        return timeString >= checkInStartTime && timeString <= checkInEndTime;
      });
    }

    // Filter by check-out time range
    if (checkOutStartTime && checkOutEndTime) {
      filtered = filtered.filter(record => {
        if (!record.check_out_time) return false;
        const checkOutDate = new Date(record.check_out_time);
        const timeString = format(checkOutDate, 'HH:mm');
        return timeString >= checkOutStartTime && timeString <= checkOutEndTime;
      });
    }

    setFilteredData(filtered);
  }, [attendanceData, createdAtStartDate, createdAtEndDate, checkInStartTime, checkInEndTime, checkOutStartTime, checkOutEndTime]);

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

  const clearFilters = () => {
    setCreatedAtStartDate(getTodayMalaysiaTime());
    setCreatedAtEndDate(getTodayMalaysiaTime());
    setCheckInStartTime('');
    setCheckInEndTime('');
    setCheckOutStartTime('');
    setCheckOutEndTime('');
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Attendance Records</h1>
        </div>

        {/* Filters Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Filters</span>
              <Button variant="outline" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear Filters
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-6">
              {/* Date Range Filter */}
              <div className="space-y-2">
                <Label>Date Range</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !createdAtStartDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {createdAtStartDate ? format(createdAtStartDate, "PPP") : "Start date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={createdAtStartDate}
                        onSelect={setCreatedAtStartDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !createdAtEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0" />
                        <span className="truncate">
                          {createdAtEndDate ? format(createdAtEndDate, "PPP") : "End date"}
                        </span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={createdAtEndDate}
                        onSelect={setCreatedAtEndDate}
                        initialFocus
                        className="pointer-events-auto"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>

              {/* Check-in Time Range */}
              <div className="space-y-2">
                <Label>Check-in Time Range</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="time"
                    value={checkInStartTime}
                    onChange={(e) => setCheckInStartTime(e.target.value)}
                    placeholder="Start"
                    className="w-full"
                  />
                  <Input
                    type="time"
                    value={checkInEndTime}
                    onChange={(e) => setCheckInEndTime(e.target.value)}
                    placeholder="End"
                    className="w-full"
                  />
                </div>
              </div>

              {/* Check-out Time Range */}
              <div className="space-y-2">
                <Label>Check-out Time Range</Label>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Input
                    type="time"
                    value={checkOutStartTime}
                    onChange={(e) => setCheckOutStartTime(e.target.value)}
                    placeholder="Start"
                    className="w-full"
                  />
                  <Input
                    type="time"
                    value={checkOutEndTime}
                    onChange={(e) => setCheckOutEndTime(e.target.value)}
                    placeholder="End"
                    className="w-full"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Table */}
        <Card>
          <CardHeader>
            <CardTitle>Attendance Records ({filteredData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Location</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, idx) => (
                      <TableRow key={idx}>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        No attendance records found
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredData.map((record) => (
                      <TableRow key={record.attendance_id}>
                        <TableCell>
                          {record.created_at ? format(new Date(record.created_at), 'PPP') : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={getStatusBadgeVariant(record.status)}>
                            {record.status.replace('_', ' ').toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {record.check_in_time 
                            ? format(new Date(record.check_in_time), 'HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          {record.check_out_time 
                            ? format(new Date(record.check_out_time), 'HH:mm')
                            : '-'}
                        </TableCell>
                        <TableCell className="max-w-xs truncate">
                          {record.location || '-'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
