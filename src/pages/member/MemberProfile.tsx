import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Camera, Mail, Phone, Building2, Users } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { PublicFaceScanDialog } from '@/components/PublicFaceScanDialog';
import { useToast } from '@/hooks/use-toast';

type UserProfile = {
  user_id: string;
  username: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  email: string | null;
  phone_number: string | null;
  photo_url: string | null;
  department_id: string | null;
  group_id: string | null;
};

type Department = {
  department_id: string;
  department_name: string;
};

type Group = {
  group_id: string;
  group_name: string;
};

export default function MemberProfile() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [department, setDepartment] = useState<Department | null>(null);
  const [group, setGroup] = useState<Group | null>(null);
  const [showFaceScan, setShowFaceScan] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('auth_uuid', user?.id)
        .single();

      if (profileError) throw profileError;
      setUserProfile(profileData);

      // Fetch department if exists
      if (profileData?.department_id) {
        const { data: deptData } = await supabase
          .from('department')
          .select('department_id, department_name')
          .eq('department_id', profileData.department_id)
          .single();
        
        if (deptData) setDepartment(deptData);
      }

      // Fetch group if exists
      if (profileData?.group_id) {
        const { data: groupData } = await supabase
          .from('group')
          .select('group_id, group_name')
          .eq('group_id', profileData.group_id)
          .single();
        
        if (groupData) setGroup(groupData);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load profile information',
      });
    } finally {
      setLoading(false);
    }
  };

  const getFullName = () => {
    if (!userProfile) return 'N/A';
    const parts = [
      userProfile.first_name,
      userProfile.middle_name,
      userProfile.last_name
    ].filter(Boolean);
    return parts.join(' ') || 'N/A';
  };

  const getInitials = () => {
    if (!userProfile?.first_name) return '?';
    return userProfile.first_name[0].toUpperCase();
  };

  return (
    <DashboardLayout>
      <div className="p-4 md:p-6 lg:p-8 space-y-6 md:space-y-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">My Profile</h1>
          <p className="text-muted-foreground mt-2 text-sm md:text-base">
            View and manage your account information
          </p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-start gap-4 sm:gap-6">
                  {/* Profile Photo */}
                  <Avatar className="h-20 w-20 sm:h-24 sm:w-24">
                    {userProfile?.photo_url ? (
                      <AvatarImage src={userProfile.photo_url} alt="Profile photo" />
                    ) : null}
                    <AvatarFallback className="bg-primary/10 text-primary text-xl sm:text-2xl">
                      {getInitials()}
                    </AvatarFallback>
                  </Avatar>

                  {/* Profile Info */}
                  <div className="flex-1 w-full space-y-4">
                    <div>
                      <h3 className="text-xl sm:text-2xl font-bold text-foreground">{getFullName()}</h3>
                      <p className="text-muted-foreground text-sm sm:text-base">@{userProfile?.username || 'N/A'}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">Email</p>
                          <p className="font-medium break-words">{userProfile?.email || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">Phone</p>
                          <p className="font-medium break-words">{userProfile?.phone_number || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">Department</p>
                          <p className="font-medium break-words">{department?.department_name || 'N/A'}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-3">
                        <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">Group</p>
                          <p className="font-medium break-words">{group?.group_name || 'N/A'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => setShowFaceScan(true)}
              className="w-full sm:w-auto"
            >
              <Camera className="h-4 w-4 mr-2" />
              Scan Face for Attendance
            </Button>
          </CardContent>
        </Card>
      </div>

      <PublicFaceScanDialog open={showFaceScan} onOpenChange={setShowFaceScan} />
    </DashboardLayout>
  );
}
