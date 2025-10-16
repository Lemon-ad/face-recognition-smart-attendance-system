import { useEffect } from 'react';
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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { LocationMapPicker } from './LocationMapPicker';

type Department = Tables<'department'>;

const formSchema = z.object({
  department_name: z.string().min(1, 'Department name is required'),
  department_location: z.string().optional(),
  geofence_radius: z.number().min(1, 'Radius must be at least 1 meter').optional(),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  department_description: z.string().optional(),
});

interface DepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  onSuccess: () => void;
}

export function DepartmentDialog({
  open,
  onOpenChange,
  department,
  onSuccess,
}: DepartmentDialogProps) {
  const { toast } = useToast();
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      department_name: '',
      department_location: '',
      geofence_radius: 500,
      start_time: '',
      end_time: '',
      department_description: '',
    },
  });

  useEffect(() => {
    if (department) {
      form.reset({
        department_name: department.department_name || '',
        department_location: department.department_location || '',
        geofence_radius: department.geofence_radius || 500,
        start_time: department.start_time || '',
        end_time: department.end_time || '',
        department_description: department.department_description || '',
      });
    } else {
      form.reset({
        department_name: '',
        department_location: '',
        geofence_radius: 500,
        start_time: '',
        end_time: '',
        department_description: '',
      });
    }
  }, [department, form, open]);

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      if (department) {
        const { error } = await supabase
          .from('department')
          .update({
            department_name: data.department_name,
            department_location: data.department_location || null,
            geofence_radius: data.geofence_radius || 500,
            start_time: data.start_time || null,
            end_time: data.end_time || null,
            department_description: data.department_description || null,
          })
          .eq('department_id', department.department_id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Department updated successfully',
        });
      } else {
        const { error } = await supabase.from('department').insert({
          department_name: data.department_name,
          department_location: data.department_location || null,
          geofence_radius: data.geofence_radius || 500,
          start_time: data.start_time || null,
          end_time: data.end_time || null,
          department_description: data.department_description || null,
        });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Department created successfully',
        });
      }

      onSuccess();
      onOpenChange(false);
      form.reset();
    } catch (error) {
      console.error('Error saving department:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to save department',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {department ? 'Edit Department' : 'Add Department'}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="department_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Department Name *</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter department name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="department_location"
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
              name="department_description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Enter department description"
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
                {department ? 'Update' : 'Create'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
