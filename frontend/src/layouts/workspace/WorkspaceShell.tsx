import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import type { WorkspaceNavItem } from './navConfig';
import Breadcrumbs from '../../components/shared/Breadcrumbs';
import { Bell, GraduationCap, LogOut } from 'lucide-react';
import { useState } from 'react';

interface WorkspaceShellProps {
  workspaceTitle: string;
  navItems: WorkspaceNavItem[];
}

export default function WorkspaceShell({ workspaceTitle, navItems }: WorkspaceShellProps) {
  const navigate = useNavigate();
  const clearAuth = useAuthStore((s) => s.clearAuth);
  const full_name = useAuthStore((s) => s.user?.full_name);
  const userName = full_name ?? 'User';
  const [hasNotifications] = useState(true);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen flex-col overflow-x-hidden bg-gray-50 font-display md:flex-row dark:bg-background-dark">
      <aside className="flex w-full shrink-0 flex-col border-b border-gray-200 bg-white dark:border-gray-800 dark:border-gray-900 md:h-auto md:min-h-screen md:w-64 md:border-b-0 md:border-r">
        <div className="flex h-16 items-center border-b border-gray-200 px-6 dark:border-gray-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <GraduationCap className="h-6 w-6 text-white" />
            </div>
            <div className="leading-tight">
              <span className="text-lg font-bold text-gray-900 dark:text-white">UniMentee</span>
              <p className="text-xs text-gray-500 dark:text-gray-400">{workspaceTitle}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      `relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary before:absolute before:bottom-0 before:left-0 before:top-0 before:w-1 before:rounded-r before:bg-primary dark:bg-primary/20'
                          : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800'
                      }`
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="font-medium">{item.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-gray-200 p-4 dark:border-gray-800">
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <span className="text-sm font-semibold text-primary">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{userName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-16 w-full shrink-0 items-center justify-end gap-4 border-b border-gray-200 bg-white px-6 dark:border-gray-800 dark:bg-gray-900">
          <button
            type="button"
            className="relative rounded-lg p-2 transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5 text-gray-700 dark:text-gray-300" />
            {hasNotifications && (
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
            )}
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
              <span className="text-xs font-semibold text-primary">{userName.charAt(0).toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium text-gray-900 dark:text-white">{userName}</span>
          </div>
        </header>

        <main className="w-full min-w-0 flex-1 overflow-auto p-6">
          <Breadcrumbs />
          <Outlet />
        </main>
      </div>
    </div>
  );
}
