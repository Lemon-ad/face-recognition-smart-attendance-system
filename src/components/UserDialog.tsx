import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Upload } from 'lucide-react';

const userSchema = z.object({
  username: z.string().min(3, 'Username must be at least 3 characters'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters').optional(),
  first_name: z.string().min(1, 'First name is required'),
  middle_name: z.string().optional(),
  last_name: z.string().min(1, 'Last name is required'),
  phone_number: z.string().optional(),
  ic_number: z.string().optional(),
  position_name: z.string().optional(),
  department_id: z.string().optional(),
  group_id: z.string().optional(),
});

type UserFormData = z.infer<typeof userSchema>;

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: Tables<'users'> | null;
  onSuccess: () => void;
}

export function UserDialog({ open, onOpenChange, user, onSuccess }: UserDialogProps) {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isEdit = !!user;

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  });

  useEffect(() => {
    if (user) {
      setValue('username', user.username || '');
      setValue('email', user.email || '');
      setValue('first_name', user.first_name || '');
      setValue('middle_name', user.middle_name || '');
      setValue('last_name', user.last_name || '');
      setValue('phone_number', user.phone_number || '');
      setValue('ic_number', user.ic_number || '');
      setValue('position_name', user.position_name || '');
      setValue('department_id', user.department_id || '');
      setValue('group_id', user.group_id || '');
      setPhotoUrl(user.photo_url || null);
    } else {
      reset({
        username: '',
        email: '',
        first_name: '',
        middle_name: '',
        last_name: '',
        phone_number: '',
        ic_number: '',
        position_name: '',
        department_id: '',
        group_id: '',
      });
      setPhotoUrl(null);
    }
  }, [user, setValue, reset]);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please select an image file',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please select an image smaller than 5MB',
      });
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('image', file);

      const { data, error } = await supabase.functions.invoke('upload-image', {
        body: formData,
      });

      if (error) throw error;

      const newUrl = data?.display_url || data?.url;
      if (newUrl) {
        setPhotoUrl(newUrl);
        toast({
          title: 'Success',
          description: 'Photo uploaded successfully',
        });
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to upload photo',
      });
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (data: UserFormData) => {
    setLoading(true);

    try {
      if (isEdit) {
        // Update existing user
        const { error: updateError } = await supabase
          .from('users')
          .update({
            username: data.username,
            email: data.email,
            first_name: data.first_name,
            middle_name: data.middle_name || null,
            last_name: data.last_name,
            phone_number: data.phone_number || null,
            ic_number: data.ic_number || null,
            position_name: data.position_name || null,
            department_id: data.department_id || null,
            group_id: data.group_id || null,
            photo_url: photoUrl,
          })
          .eq('user_id', user!.user_id);

        if (updateError) throw updateError;

        toast({
          title: 'Success',
          description: 'User updated successfully',
        });
      } else {
        // Create new user in auth
        if (!data.password) {
          throw new Error('Password is required for new users');
        }

        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: data.email,
          password: data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: {
              first_name: data.first_name,
              last_name: data.last_name,
            },
          },
        });

        if (authError) throw authError;
        if (!authData.user) throw new Error('Failed to create user');

        // Create user in users table
        const { error: insertError } = await supabase.from('users').insert({
          auth_uuid: authData.user.id,
          username: data.username,
          email: data.email,
          first_name: data.first_name,
          middle_name: data.middle_name || null,
          last_name: data.last_name,
          phone_number: data.phone_number || null,
          ic_number: data.ic_number || null,
          role: 'member',
          position_name: data.position_name || null,
          department_id: data.department_id || null,
          group_id: data.group_id || null,
          photo_url: photoUrl,
        });

        if (insertError) throw insertError;

        toast({
          title: 'Success',
          description: 'User created successfully',
        });
      }

      onSuccess();
      onOpenChange(false);
      reset();
    } catch (error) {
      console.error('Error saving user:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save user',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[600px] sm:w-[600px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEdit ? 'Edit User' : 'Add New User'}</SheetTitle>
          <SheetDescription>
            {isEdit
              ? 'Update user information below'
              : 'Fill in the details to create a new user account'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Profile Photo Upload */}
          <div className="flex flex-col items-center space-y-4 pb-4 border-b">
            <Avatar className="h-24 w-24">
              {photoUrl ? (
                <AvatarImage src={photoUrl} alt="Profile photo" />
              ) : null}
              <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                {watch('first_name')?.[0] || <Camera className="h-10 w-10" />}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                <Upload className="h-4 w-4 mr-2" />
                {uploading ? 'Uploading...' : 'Upload Photo'}
              </Button>
              {photoUrl && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setPhotoUrl(null)}
                  disabled={uploading}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="username">Username *</Label>
              <Input
                id="username"
                {...register('username')}
                placeholder="Enter username"
              />
              {errors.username && (
                <p className="text-sm text-destructive">{errors.username.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="user@example.com"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="Minimum 6 characters"
              />
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password.message}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name *</Label>
              <Input
                id="first_name"
                {...register('first_name')}
                placeholder="First name"
              />
              {errors.first_name && (
                <p className="text-sm text-destructive">{errors.first_name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="middle_name">Middle Name</Label>
              <Input
                id="middle_name"
                {...register('middle_name')}
                placeholder="Middle name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name *</Label>
              <Input
                id="last_name"
                {...register('last_name')}
                placeholder="Last name"
              />
              {errors.last_name && (
                <p className="text-sm text-destructive">{errors.last_name.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone_number">Phone Number</Label>
              <Input
                id="phone_number"
                {...register('phone_number')}
                placeholder="+60123456789"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="ic_number">IC Number</Label>
              <Input
                id="ic_number"
                {...register('ic_number')}
                placeholder="IC Number"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position_name">Position</Label>
            <Input
              id="position_name"
              {...register('position_name')}
              placeholder="Job position"
            />
          </div>

          <SheetFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving...' : isEdit ? 'Update User' : 'Create User'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
