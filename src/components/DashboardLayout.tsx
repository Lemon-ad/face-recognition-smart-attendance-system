import { ReactNode, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  ClipboardList,
  LogOut,
  User,
  Menu,
  X
} from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { ThemeToggle } from '@/components/ThemeToggle';

interface DashboardLayoutProps {
  children: ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { signOut, userRole } = useAuth();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const adminNavItems = [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/admin/users', icon: Users, label: 'User Management' },
    { to: '/admin/departments', icon: Building2, label: 'Departments & Groups' },
    { to: '/admin/attendance', icon: ClipboardList, label: 'Attendance' },
  ];

  const memberNavItems = [
    { to: '/member', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/member/attendance', icon: ClipboardList, label: 'Attendance Record' },
    { to: '/member/profile', icon: User, label: 'My Profile' },
  ];

  const navItems = userRole === 'admin' ? adminNavItems : memberNavItems;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      {/* Mobile Menu Toggle */}
      {isMobile && (
        <div className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-border flex items-center justify-between px-4 z-40">
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
            <h1 className="ml-4 text-lg font-bold text-primary">
              Smart Attendance
            </h1>
          </div>
          <ThemeToggle />
        </div>
      )}

      {/* Sidebar */}
      <aside className={`
        ${isMobile ? 'fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300' : 'w-64'}
        ${isMobile && !mobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
        bg-card border-r border-border flex flex-col h-screen
      `}>
        {/* Logo */}
        {!isMobile && (
          <div className="h-16 flex items-center justify-between px-4 border-b border-border">
            <h1 className="text-xl font-bold text-primary">
              Smart Attendance
            </h1>
            <ThemeToggle />
          </div>
        )}
        {isMobile && <div className="h-16" />}

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end
              onClick={() => isMobile && setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-primary hover:bg-primary/5'
                }`
              }
            >
              <item.icon className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Sign Out */}
        <div className="mt-auto flex flex-col">
          <div className="px-4 pt-4">
            <button
              onClick={signOut}
              className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-primary hover:bg-primary/5 w-full"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </div>
          <div className="mt-4 flex-1 min-h-24 bg-muted" />
        </div>
      </aside>

      {/* Overlay for mobile */}
      {isMobile && mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main Content */}
      <main className={`flex-1 overflow-auto ${isMobile ? 'pt-16' : ''}`}>
        {children}
      </main>
    </div>
  );
}
