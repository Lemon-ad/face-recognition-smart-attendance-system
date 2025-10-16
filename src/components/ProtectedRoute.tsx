import { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface ProtectedRouteProps {
  children: ReactNode;
  requireRole?: 'admin' | 'member';
}

export function ProtectedRoute({ children, requireRole }: ProtectedRouteProps) {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        navigate('/auth');
      } else if (requireRole && userRole !== requireRole) {
        // Redirect to appropriate dashboard based on actual role
        if (userRole === 'admin') {
          navigate('/admin');
        } else if (userRole === 'member') {
          navigate('/member');
        }
      }
    }
  }, [user, userRole, loading, requireRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="h-12 w-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-muted-foreground mt-4">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user || (requireRole && userRole !== requireRole)) {
    return null;
  }

  return <>{children}</>;
}
