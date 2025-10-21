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
import { useToast } from '@/hooks/use-toast';

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({ open, onOpenChange }: ForgotPasswordDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleResetPassword = async () => {
    setLoading(true);

    try {
      // Fetch all admin users from database
      const { data: adminUsers, error: fetchError } = await supabase
        .from('users')
        .select('email')
        .eq('role', 'admin');

      if (fetchError) {
        throw fetchError;
      }

      if (!adminUsers || adminUsers.length === 0) {
        toast({
          variant: 'destructive',
          title: 'No Admin Users',
          description: 'No admin accounts found in the system.',
        });
        setLoading(false);
        return;
      }

      // Send password reset emails to all admins
      let successCount = 0;
      let errorCount = 0;

      for (const admin of adminUsers) {
        if (admin.email) {
          try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(admin.email, {
              redirectTo: `${window.location.origin}/reset-password`,
            });

            if (resetError) {
              console.error(`Failed to send reset email to ${admin.email}:`, resetError);
              errorCount++;
            } else {
              successCount++;
            }
          } catch (err) {
            console.error(`Error sending reset email to ${admin.email}:`, err);
            errorCount++;
          }
        }
      }

      if (successCount > 0) {
        toast({
          title: 'Password Reset Emails Sent',
          description: `Successfully sent password reset instructions to ${successCount} admin account${successCount > 1 ? 's' : ''}.`,
        });
      }

      if (errorCount > 0) {
        toast({
          variant: 'destructive',
          title: 'Some Emails Failed',
          description: `Failed to send reset emails to ${errorCount} admin account${errorCount > 1 ? 's' : ''}.`,
        });
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error sending reset emails:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to send password reset emails. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Admin Password</DialogTitle>
          <DialogDescription>
            This will send password reset instructions to all admin accounts in the system.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-muted p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Password reset emails will be sent to all administrators. Each admin will receive instructions to reset their password.
            </p>
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
            {loading ? 'Sending...' : 'Send Reset Emails'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
