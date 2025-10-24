import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async () => {
    if (!username) {
      toast({
        variant: 'destructive',
        title: 'Username Required',
        description: 'Please enter your username.',
      });
      return;
    }

    setLoading(true);

    try {
      // Look up the admin user's email by username
      const { data: user, error: userError } = await supabase
        .from('users')
        .select('email, role')
        .eq('username', username)
        .eq('role', 'admin')
        .single();

      if (userError || !user) {
        toast({
          variant: 'destructive',
          title: 'Admin Not Found',
          description: 'No admin account found with this username.',
        });
        setLoading(false);
        return;
      }

      if (!user.email) {
        toast({
          variant: 'destructive',
          title: 'No Email Found',
          description: 'This admin account does not have an email address.',
        });
        setLoading(false);
        return;
      }

      // Send password reset email to the admin
      const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) {
        throw error;
      }

      toast({
        title: 'Password Reset Email Sent',
        description: 'A password reset link has been sent to the admin email address.',
      });

      onOpenChange(false);
      setUsername('');
    } catch (error) {
      console.error('Error sending reset email:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send password reset email. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Admin Password Reset</DialogTitle>
          <DialogDescription>
            Enter your admin username to receive password reset instructions via email.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              type="text"
              placeholder="Enter your admin username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) {
                  handleResetPassword();
                }
              }}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleResetPassword} 
            disabled={loading} 
            className="w-full sm:w-auto"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
