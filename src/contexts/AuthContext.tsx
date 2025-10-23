import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: 'admin' | 'member' | null;
  loading: boolean;
  signIn: (username: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'member' | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Fetch user role when session changes
        if (session?.user) {
          setTimeout(() => {
            fetchUserRole(session.user.id);
          }, 0);
        } else {
          setUserRole(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserRole(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchUserRole = async (authUuid: string) => {
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUuid)
        .maybeSingle();

      if (error) throw error;
      setUserRole(data?.role ?? null);
    } catch (error) {
      console.error('Error fetching user role:', error);
      setUserRole(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (username: string, password: string) => {
    try {
      // Use secure function to check if username exists (without exposing user data)
      const { data: usernameExists, error: checkError } = await supabase
        .rpc('username_exists', { username_input: username });

      if (checkError) {
        console.error('Error checking username:', checkError);
        return { error: new Error('Authentication failed') };
      }

      if (!usernameExists) {
        return { error: new Error('Invalid username or password') };
      }

      // Now we need the email for sign in, but only after confirming username exists
      // This requires the user to be authenticated or admin, but for login we need a different approach
      // We'll need to fetch it with admin privileges or store email in a way that's accessible
      // For now, let's fetch with the existing RLS policies which should allow after username check
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('email')
        .eq('username', username)
        .maybeSingle();

      if (userError || !userData?.email) {
        return { error: new Error('Invalid username or password') };
      }

      // Try to sign in with email and password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: userData.email,
        password: password,
      });

      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          return { error: new Error('Invalid username or password') };
        }
        return { error: signInError };
      }

      return { error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { error: new Error('Authentication failed') };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUserRole(null);
    navigate('/auth');
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
