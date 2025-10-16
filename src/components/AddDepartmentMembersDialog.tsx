import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

type User = Tables<'users'>;
type Department = Tables<'department'>;

interface AddDepartmentMembersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  onSuccess: () => void;
}

export function AddDepartmentMembersDialog({
  open,
  onOpenChange,
  department,
  onSuccess,
}: AddDepartmentMembersDialogProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && department) {
      fetchUsers();
    } else {
      setSelectedUserIds([]);
      setSearchQuery('');
    }
  }, [open, department]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('first_name', { ascending: true });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch users',
      });
    }
  };

  const handleToggleUser = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSubmit = async () => {
    if (!department || selectedUserIds.length === 0) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('users')
        .update({ department_id: department.department_id })
        .in('user_id', selectedUserIds);

      if (error) throw error;

      toast({
        title: 'Success',
        description: `${selectedUserIds.length} user(s) added to department`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error adding users to department:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to add users to department',
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter((user) => {
    // Exclude admin users
    if (user.role === 'admin') return false;
    
    const searchLower = searchQuery.toLowerCase();
    const fullName = `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`.toLowerCase();
    return (
      fullName.includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.username?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Members to {department?.department_name}</DialogTitle>
          <DialogDescription>
            Select users to add to this department
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <ScrollArea className="h-[400px] border rounded-lg">
            <div className="p-4 space-y-2">
              {filteredUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No users found
                </p>
              ) : (
                filteredUsers.map((user) => (
                  <div
                    key={user.user_id}
                    className="flex items-center space-x-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleToggleUser(user.user_id)}
                  >
                    <Checkbox
                      checked={selectedUserIds.includes(user.user_id)}
                      onCheckedChange={() => handleToggleUser(user.user_id)}
                    />
                    <div className="flex-1">
                      <p className="font-medium">
                        {user.first_name} {user.middle_name} {user.last_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {user.email || user.username}
                      </p>
                    </div>
                    {user.department_id === department?.department_id && (
                      <span className="text-xs text-muted-foreground">
                        Already in department
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <p className="text-sm text-muted-foreground">
            {selectedUserIds.length} user(s) selected
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading || selectedUserIds.length === 0}>
            {loading ? 'Adding...' : 'Add Members'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
