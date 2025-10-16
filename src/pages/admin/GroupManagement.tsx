import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { GroupDialog } from '@/components/GroupDialog';

type Group = Tables<'group'>;
type Department = Tables<'department'>;

interface GroupWithDepartment extends Group {
  department?: Department;
}

export default function GroupManagement() {
  const [groups, setGroups] = useState<GroupWithDepartment[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<GroupWithDepartment[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithDepartment | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchGroups();

    const channel = supabase
      .channel('groups-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'group',
        },
        () => {
          fetchGroups();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    const filtered = groups.filter((group) => {
      const searchLower = searchQuery.toLowerCase();
      return (
        group.group_name?.toLowerCase().includes(searchLower) ||
        group.group_location?.toLowerCase().includes(searchLower) ||
        group.department?.department_name?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredGroups(filtered);
  }, [searchQuery, groups]);

  const fetchGroups = async () => {
    try {
      const { data, error } = await supabase
        .from('group')
        .select(`
          *,
          department:department_id (*)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGroups(data || []);
    } catch (error) {
      console.error('Error fetching groups:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch groups',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddGroup = () => {
    setSelectedGroup(null);
    setGroupDialogOpen(true);
  };

  const handleEditGroup = (group: GroupWithDepartment) => {
    setSelectedGroup(group);
    setGroupDialogOpen(true);
  };

  const handleDeleteClick = (group: GroupWithDepartment) => {
    setSelectedGroup(group);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!selectedGroup) return;

    try {
      const { error } = await supabase
        .from('group')
        .delete()
        .eq('group_id', selectedGroup.group_id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Group deleted successfully',
      });

      setDeleteDialogOpen(false);
      setSelectedGroup(null);
      await fetchGroups();
    } catch (error) {
      console.error('Error deleting group:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete group',
      });
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Group Management</h1>
            <p className="text-muted-foreground mt-2">
              Manage groups within departments
            </p>
          </div>
          <Button onClick={handleAddGroup}>
            <Plus className="h-4 w-4 mr-2" />
            Add Group
          </Button>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search groups..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Group Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Start Time</TableHead>
                <TableHead>End Time</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex items-center justify-center">
                      <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <span className="ml-3 text-muted-foreground">Loading groups...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredGroups.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    {searchQuery
                      ? 'No groups found matching your search.'
                      : 'No groups found. Click "Add Group" to create the first group.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredGroups.map((group) => (
                  <TableRow key={group.group_id}>
                    <TableCell className="font-medium">{group.group_name}</TableCell>
                    <TableCell>
                      {group.department ? (
                        <Badge variant="outline">
                          {group.department.department_name}
                        </Badge>
                      ) : (
                        'N/A'
                      )}
                    </TableCell>
                    <TableCell>{group.group_location || 'N/A'}</TableCell>
                    <TableCell>{group.start_time || 'N/A'}</TableCell>
                    <TableCell>{group.end_time || 'N/A'}</TableCell>
                    <TableCell className="max-w-xs truncate">{group.group_description || 'N/A'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditGroup(group)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(group)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        group={selectedGroup}
        departmentId={selectedGroup?.department_id || null}
        onSuccess={fetchGroups}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the group
              <strong> {selectedGroup?.group_name}</strong>.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
