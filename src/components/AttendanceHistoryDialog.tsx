import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { CalendarIcon } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface User {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
}

interface HistoryRecord {
  history_id: string;
  user_id: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  location: string | null;
  attendance_date: string;
  archived_at: string;
}

interface HistoryWithUser {
  record: HistoryRecord;
  user: User | null;
}

interface AttendanceHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AttendanceHistoryDialog({ open, onOpenChange }: AttendanceHistoryDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [historyData, setHistoryData] = useState<HistoryWithUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (open) {
      fetchHistoryData();
    }
  }, [selectedDate, open]);

  const fetchHistoryData = async () => {
    try {
      setLoading(true);
      
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      const { data: historyRecords, error: historyError } = await supabase
        .from('attendance_history')
        .select('*')
        .eq('attendance_date', dateStr)
        .order('check_in_time', { ascending: true });

      if (historyError) throw historyError;

      if (!historyRecords || historyRecords.length === 0) {
        setHistoryData([]);
        return;
      }

      const userIds = [...new Set(historyRecords.map(r => r.user_id))];
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('user_id, first_name, last_name, username')
        .in('user_id', userIds);

      if (usersError) throw usersError;

      const mappedData: HistoryWithUser[] = historyRecords.map(record => {
        const user = users?.find(u => u.user_id === record.user_id);
        return {
          record,
          user: user || null,
        };
      });

      setHistoryData(mappedData);
    } catch (error) {
      console.error('Error fetching history data:', error);
      toast.error('Failed to load attendance history');
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

  const getUserName = (user: User | null) => {
    if (!user) return 'Unknown User';
    return user.first_name && user.last_name
      ? `${user.first_name} ${user.last_name}`
      : user.username || 'Unknown User';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Attendance History</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Select Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start text-left font-normal"
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {format(selectedDate, 'PPP')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => date && setSelectedDate(date)}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

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
                  <TableHead>Archived At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historyData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      No attendance history found for this date
                    </TableCell>
                  </TableRow>
                ) : (
                  historyData.map((data) => (
                    <TableRow key={data.record.history_id}>
                      <TableCell className="font-medium">
                        {getUserName(data.user)}
                      </TableCell>
                      <TableCell>
                        {data.record.check_in_time
                          ? format(new Date(data.record.check_in_time), 'MMM dd, yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        {data.record.check_out_time
                          ? format(new Date(data.record.check_out_time), 'MMM dd, yyyy HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusBadgeVariant(data.record.status)}>
                          {data.record.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{data.record.location || '-'}</TableCell>
                      <TableCell>
                        {format(new Date(data.record.archived_at), 'MMM dd, yyyy HH:mm')}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
