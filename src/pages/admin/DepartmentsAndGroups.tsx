import { DashboardLayout } from '@/components/DashboardLayout';
import { useState, useEffect } from 'react';
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
import { DepartmentDialog } from '@/components/DepartmentDialog';
import { GroupDialog } from '@/components/GroupDialog';
import { AddDepartmentMembersDialog } from '@/components/AddDepartmentMembersDialog';
import { Users } from 'lucide-react';

type Department = Tables<'department'>;
type Group = Tables<'group'>;

interface GroupWithDepartment extends Group {
  department?: Department;
}

export default function DepartmentsAndGroups() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [departmentSearchQuery, setDepartmentSearchQuery] = useState('');
  
  const [groups, setGroups] = useState<GroupWithDepartment[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<GroupWithDepartment[]>([]);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  const [addMembersDialogOpen, setAddMembersDialogOpen] = useState(false);
  const [departmentForMembers, setDepartmentForMembers] = useState<Department | null>(null);
  
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithDepartment | null>(null);
  const [deleteType, setDeleteType] = useState<'department' | 'group'>('department');
  
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchDepartments();
    fetchGroups();

    const departmentChannel = supabase
      .channel('departments-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'department' },
        () => fetchDepartments()
      )
      .subscribe();

    const groupChannel = supabase
      .channel('groups-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'group' },
        () => fetchGroups()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(departmentChannel);
      supabase.removeChannel(groupChannel);
    };
  }, []);

  useEffect(() => {
    const filtered = departments.filter((dept) => {
      const searchLower = departmentSearchQuery.toLowerCase();
      return (
        dept.department_name?.toLowerCase().includes(searchLower) ||
        dept.department_location?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredDepartments(filtered);
  }, [departmentSearchQuery, departments]);

  useEffect(() => {
    if (selectedDepartmentId) {
      const filtered = groups.filter((group) => {
        const matchesDepartment = group.department_id === selectedDepartmentId;
        const searchLower = groupSearchQuery.toLowerCase();
        const matchesSearch = 
          group.group_name?.toLowerCase().includes(searchLower) ||
          group.group_location?.toLowerCase().includes(searchLower);
        return matchesDepartment && matchesSearch;
      });
      setFilteredGroups(filtered);
    } else {
      setFilteredGroups([]);
    }
  }, [groupSearchQuery, groups, selectedDepartmentId]);

  const fetchDepartments = async () => {
    try {
      const { data, error } = await supabase
        .from('department')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to fetch departments',
      });
    } finally {
      setLoading(false);
    }
  };

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
    }
  };

  const handleDeleteDepartment = async () => {
    if (!selectedDepartment) return;

    try {
      const { error } = await supabase
        .from('department')
        .delete()
        .eq('department_id', selectedDepartment.department_id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Department deleted successfully',
      });

      setDeleteDialogOpen(false);
      setSelectedDepartment(null);
      await fetchDepartments();
    } catch (error) {
      console.error('Error deleting department:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to delete department',
      });
    }
  };

  const handleDeleteGroup = async () => {
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
        <div>
          <h1 className="text-3xl font-bold text-foreground">Departments & Groups</h1>
          <p className="text-muted-foreground mt-2">
            Manage departments and their groups
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 divide-x divide-border">
          <div className="pr-6">{/* Divider wrapper for departments */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">Departments</h2>
              <Button onClick={() => {
                setSelectedDepartment(null);
                setDepartmentDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search departments..."
                value={departmentSearchQuery}
                onChange={(e) => setDepartmentSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12">
                        <div className="flex items-center justify-center">
                          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="ml-3 text-muted-foreground">Loading...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredDepartments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        {departmentSearchQuery
                          ? 'No departments found.'
                          : 'No departments. Click "Add Department" to create one.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <TableRow 
                        key={dept.department_id}
                        className={`cursor-pointer ${selectedDepartmentId === dept.department_id ? 'bg-primary/10' : 'hover:bg-muted/50'}`}
                        onClick={() => setSelectedDepartmentId(dept.department_id)}
                      >
                        <TableCell className="font-medium">{dept.department_name}</TableCell>
                        <TableCell>{dept.department_location || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setDepartmentForMembers(dept);
                                setAddMembersDialogOpen(true);
                              }}
                              title="Add Members"
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDepartment(dept);
                                setDepartmentDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedDepartment(dept);
                                setDeleteType('department');
                                setDeleteDialogOpen(true);
                              }}
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
          </div>{/* End divider wrapper for departments */}

          <div className="pl-6">{/* Divider wrapper for groups */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-foreground">
                {selectedDepartmentId 
                  ? `Groups in ${departments.find(d => d.department_id === selectedDepartmentId)?.department_name || 'Department'}`
                  : 'Groups'}
              </h2>
              <Button 
                onClick={() => {
                  setSelectedGroup(null);
                  setGroupDialogOpen(true);
                }}
                disabled={!selectedDepartmentId}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search groups..."
                value={groupSearchQuery}
                onChange={(e) => setGroupSearchQuery(e.target.value)}
                className="pl-10"
                disabled={!selectedDepartmentId}
              />
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Group Name</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {!selectedDepartmentId ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        Select a department to view its groups
                      </TableCell>
                    </TableRow>
                  ) : loading ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12">
                        <div className="flex items-center justify-center">
                          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="ml-3 text-muted-foreground">Loading...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-12 text-muted-foreground">
                        {groupSearchQuery
                          ? 'No groups found.'
                          : 'No groups. Click "Add Group" to create one.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredGroups.map((group) => (
                      <TableRow key={group.group_id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{group.group_name}</TableCell>
                        <TableCell>{group.group_location || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedGroup(group);
                                setGroupDialogOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedGroup(group);
                                setDeleteType('group');
                                setDeleteDialogOpen(true);
                              }}
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
          </div>{/* End divider wrapper for groups */}
        </div>
      </div>

      <DepartmentDialog
        open={departmentDialogOpen}
        onOpenChange={setDepartmentDialogOpen}
        department={selectedDepartment}
        onSuccess={fetchDepartments}
      />

      <GroupDialog
        open={groupDialogOpen}
        onOpenChange={setGroupDialogOpen}
        group={selectedGroup}
        departmentId={selectedDepartmentId}
        onSuccess={fetchGroups}
      />

      <AddDepartmentMembersDialog
        open={addMembersDialogOpen}
        onOpenChange={setAddMembersDialogOpen}
        department={departmentForMembers}
        onSuccess={fetchDepartments}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the {deleteType}
              <strong>
                {' '}
                {deleteType === 'department'
                  ? selectedDepartment?.department_name
                  : selectedGroup?.group_name}
              </strong>
              {deleteType === 'department' && ' and all associated groups'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteType === 'department' ? handleDeleteDepartment : handleDeleteGroup}
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
