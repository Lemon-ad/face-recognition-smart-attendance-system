import { DashboardLayout } from '@/components/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
  
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [departmentDialogOpen, setDepartmentDialogOpen] = useState(false);
  const [groupDialogOpen, setGroupDialogOpen] = useState(false);
  
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
    const filtered = groups.filter((group) => {
      const searchLower = groupSearchQuery.toLowerCase();
      return (
        group.group_name?.toLowerCase().includes(searchLower) ||
        group.group_location?.toLowerCase().includes(searchLower) ||
        group.department?.department_name?.toLowerCase().includes(searchLower)
      );
    });
    setFilteredGroups(filtered);
  }, [groupSearchQuery, groups]);

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

        <Tabs defaultValue="departments" className="w-full">
          <TabsList>
            <TabsTrigger value="departments">Departments</TabsTrigger>
            <TabsTrigger value="groups">Groups</TabsTrigger>
          </TabsList>

          <TabsContent value="departments" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search departments..."
                  value={departmentSearchQuery}
                  onChange={(e) => setDepartmentSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => {
                setSelectedDepartment(null);
                setDepartmentDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Department
              </Button>
            </div>

            <div className="bg-card rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Department Name</TableHead>
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
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex items-center justify-center">
                          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                          <span className="ml-3 text-muted-foreground">Loading departments...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredDepartments.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                        {departmentSearchQuery
                          ? 'No departments found matching your search.'
                          : 'No departments found. Click "Add Department" to create the first department.'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDepartments.map((dept) => (
                      <TableRow key={dept.department_id}>
                        <TableCell className="font-medium">{dept.department_name}</TableCell>
                        <TableCell>{dept.department_location || 'N/A'}</TableCell>
                        <TableCell>{dept.start_time || 'N/A'}</TableCell>
                        <TableCell>{dept.end_time || 'N/A'}</TableCell>
                        <TableCell className="max-w-xs truncate">{dept.department_description || 'N/A'}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
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
          </TabsContent>

          <TabsContent value="groups" className="space-y-6 mt-6">
            <div className="flex items-center justify-between">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search groups..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button onClick={() => {
                setSelectedGroup(null);
                setGroupDialogOpen(true);
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Group
              </Button>
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
                        {groupSearchQuery
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
          </TabsContent>
        </Tabs>
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
        onSuccess={fetchGroups}
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
