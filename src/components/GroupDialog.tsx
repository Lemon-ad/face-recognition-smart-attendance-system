import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { LocationMapPicker } from './LocationMapPicker';

type Group = Tables<'group'>;
type Department = Tables<'department'>;

const formSchema = z.object({
  group_name: z.string().min(1, 'Group name is required'),
  group_location: z.string().optional(),
  geofence_radius: z.number().min(1, 'Radius must be at least 1 meter').optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  group_description: z.string().optional(),
});

interface GroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: Group | null;
  departmentId: string | null;
  onSuccess: () => void;
}

export function GroupDialog({
  open,
  onOpenChange,
  group,
  departmentId,
  onSuccess,
}: GroupDialogProps) {
  const { toast } = useToast();
  const [departmentDefaults, setDepartmentDefaults] = useState<{
    department_location: string | null;
    geofence_radius: number | null;
    start_time: string | null;
    end_time: string | null;
  } | null>(null);
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      group_name: '',
      group_location: '',
      geofence_radius: 500,
      start_time: '',
      end_time: '',
      group_description: '',
    },
  });

  // Fetch department defaults when creating a new group
  useEffect(() => {
    const fetchDepartmentDefaults = async () => {
      if (departmentId && !group) {
        const { data } = await supabase
          .from('department')
          .select('department_location, geofence_radius, start_time, end_time')
          .eq('department_id', departmentId)
          .maybeSingle();
        
        if (data) {
          setDepartmentDefaults(data);
        }
      }
    };
    
    fetchDepartmentDefaults();
  }, [departmentId, group]);

  useEffect(() => {
    if (group) {
      form.reset({
        group_name: group.group_name || '',
        group_location: group.group_location || '',
        geofence_radius: group.geofence_radius || 500,
        start_time: group.start_time || '',
        end_time: group.end_time || '',
        group_description: group.group_description || '',
      });
    } else if (departmentDefaults) {
      // Pre-fill with department defaults when creating new group
      form.reset({
        group_name: '',
        group_location: departmentDefaults.department_location || '',
        geofence_radius: departmentDefaults.geofence_radius || 500,
        start_time: departmentDefaults.start_time || '',
        end_time: departmentDefaults.end_time || '',
        group_description: '',
      });
    } else {
      form.reset({
        group_name: '',
        group_location: '',
        geofence_radius: 500,
        start_time: '',
        end_time: '',
        group_description: '',
      });
    }
  }, [group, form, open, departmentDefaults]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (!departmentId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Department is required',
      });
      return;
    }

    try {
      if (group) {
        const { error } = await supabase
          .from('group')
          .update({
            group_name: data.group_name,
            group_location: data.group_location || null,
            geofence_radius: data.geofence_radius || 500,
            start_time: data.start_time || null,
            end_time: data.end_time || null,
            group_description: data.group_description || null,
          })
          .eq('group_id', group.group_id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Group updated successfully',
        });
      } else {
        const { error } = await supabase.from('group').insert({
          group_name: data.group_name,
          department_id: departmentId,
          group_location: data.group_location || null,
          geofence_radius: data.geofence_radius || 500,
          start_time: data.start_time || null,
          end_time: data.end_time || null,
          group_description: data.group_description || null,
        });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Group created successfully',
        });
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Error saving group:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save group',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {group ? 'Edit Group' : 'Add Group'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="group_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Group Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter group name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="group_location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location (Click on map to select)</FormLabel>
                  <FormControl>
                    <LocationMapPicker
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="geofence_radius"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Geofence Radius (meters)</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      placeholder="500" 
                      {...field}
                      onChange={(e) => field.onChange(parseInt(e.target.value) || 500)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="start_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <FormControl>
                      <Input type="time" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="group_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter group description"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit">
                {group ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
