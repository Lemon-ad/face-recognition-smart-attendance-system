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

type Group = Tables<'group'>;
type Department = Tables<'department'>;

const formSchema = z.object({
  group_name: z.string().min(1, 'Group name is required'),
  group_location: z.string().optional(),
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
  
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      group_name: '',
      group_location: '',
      start_time: '',
      end_time: '',
      group_description: '',
    },
  });

  useEffect(() => {
    if (group) {
      form.reset({
        group_name: group.group_name || '',
        group_location: group.group_location || '',
        start_time: group.start_time || '',
        end_time: group.end_time || '',
        group_description: group.group_description || '',
      });
    } else {
      form.reset({
        group_name: '',
        group_location: '',
        start_time: '',
        end_time: '',
        group_description: '',
      });
    }
  }, [group, form, open]);

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
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="Enter location" {...field} />
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
