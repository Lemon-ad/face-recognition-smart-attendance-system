import { ReactNode } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  UsersRound, 
  FileText, 
  ClipboardList,
  LogOut,
  User
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut, userRole } = useAuth();

  const adminNavItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Users, label: 'User Management' },
    { to: '/admin/departments', icon: Building2, label: 'Departments' },
    { to: '/admin/groups', icon: UsersRound, label: 'Groups' },
    { to: '/admin/attendance', icon: ClipboardList, label: 'Attendance' },
    { to: '/admin/reports', icon: FileText, label: 'Reports' },
  ];

  const memberNavItems = [
    { to: '/member', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/member/profile', icon: User, label: 'My Profile' },
    { to: '/member/attendance', icon: ClipboardList, label: 'My Attendance' },
  ];

  const navItems = userRole === 'admin' ? adminNavItems : memberNavItems;

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Sidebar */}
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-sidebar-border">
          <h1 className="text-xl font-bold text-sidebar-foreground">
            Smart Attendance
          </h1>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent/50"
            onClick={signOut}
          >
            <LogOut className="h-5 w-5 mr-3" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  );
}
