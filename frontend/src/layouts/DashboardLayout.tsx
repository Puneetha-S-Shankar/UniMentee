import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { usePermission, useRole } from '../hooks/usePermission';
import { 
  Home, 
  Calendar, 
  FileText, 
  BookOpen, 
  MessageSquare, 
  Users, 
  Video, 
  BarChart3, 
  FolderOpen, 
  Settings,
  Bell,
  LogOut,
  GraduationCap
} from 'lucide-react';
import { useState } from 'react';

// Navigation configuration with role and permission checks
interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  showIf: (role: string | null, hasPermission: (key: string | string[]) => boolean) => boolean;
}

const NAV_CONFIG: NavItem[] = [
  {
    label: 'Dashboard',
    path: '/dashboard',
    icon: Home,
    showIf: () => true, // Always shown
  },
  {
    label: 'Attendance',
    path: '/attendance',
    icon: Calendar,
    showIf: (_, hasPermission) => 
      hasPermission('ATTENDANCE_MARK') || hasPermission('ATTENDANCE_VIEW_OWN'),
  },
  {
    label: 'Marks',
    path: '/marks',
    icon: FileText,
    showIf: (_, hasPermission) => 
      hasPermission('MARKS_ENTER') || hasPermission('MARKS_VIEW_OWN'),
  },
  {
    label: 'My Subjects',
    path: '/subjects',
    icon: BookOpen,
    showIf: (role) => role === 'STUDENT',
  },
  {
    label: 'Mentor Notes',
    path: '/mentor-notes',
    icon: MessageSquare,
    showIf: (role) => role === 'STUDENT',
  },
  {
    label: 'Mentees',
    path: '/mentees',
    icon: Users,
    showIf: (_, hasPermission) => hasPermission('STUDENT_VIEW'),
  },
  {
    label: 'Sessions',
    path: '/sessions',
    icon: Video,
    showIf: (role) => role === 'MENTOR' || role === 'FACULTY',
  },
  {
    label: 'Reports',
    path: '/reports',
    icon: BarChart3,
    showIf: (_, hasPermission) => hasPermission('MARKS_VIEW_ALL'),
  },
  {
    label: 'Programs',
    path: '/programs',
    icon: FolderOpen,
    showIf: (_, hasPermission) => hasPermission('ACADEMIC_MANAGE'),
  },
  {
    label: 'Users',
    path: '/users',
    icon: Settings,
    showIf: (_, hasPermission) => hasPermission('USER_MANAGE'),
  },
];

export default function DashboardLayout() {
  const navigate = useNavigate();
  const role = useRole();
  const hasPermission = usePermission;
  const clearAuth = useAuthStore((state) => state.clearAuth);
  
  // Mock user data - in real app, fetch from API
  const userName = 'User Name'; // Replace with actual user name from store/API
  const [hasNotifications] = useState(true); // Replace with actual notification state

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  // Filter navigation items based on role and permissions
  const visibleNavItems = NAV_CONFIG.filter((item) => 
    item.showIf(role, (key) => {
      if (typeof key === 'string') {
        return hasPermission(key);
      }
      return hasPermission(key);
    })
  );

  return (
    <div className="flex h-screen bg-background-light dark:bg-background-dark font-display">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
              <GraduationCap className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900 dark:text-white">
              UniMentee
            </span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {visibleNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors relative ${
                        isActive
                          ? 'bg-primary/10 text-primary dark:bg-primary/20 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1 before:bg-primary before:rounded-r'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`
                    }
                  >
                    <Icon className="w-5 h-5 flex-shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User Section */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-semibold text-sm">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                {userName}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                {role?.toLowerCase()}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="font-medium text-sm">Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 ml-64 flex flex-col">
        {/* Top Header */}
        <header className="sticky top-0 z-10 h-16 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-end px-6 gap-4">
          {/* Notification Bell */}
          <button className="relative p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-700 dark:text-gray-300" />
            {hasNotifications && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            )}
          </button>

          {/* User Avatar and Name */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
              <span className="text-primary font-semibold text-xs">
                {userName.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {userName}
            </span>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
