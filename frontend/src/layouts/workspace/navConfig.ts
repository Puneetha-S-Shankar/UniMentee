import type { LucideIcon } from 'lucide-react';
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
  School,
  LayoutDashboard,
  SlidersHorizontal,
  ScrollText,
  ClipboardCheck,
} from 'lucide-react';

export interface WorkspaceNavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export const STUDENT_NAV: WorkspaceNavItem[] = [
  { label: 'Dashboard', to: '/student/dashboard', icon: Home },
  { label: 'Attendance', to: '/student/attendance', icon: Calendar },
  { label: 'Performance', to: '/student/performance', icon: FileText },
  { label: 'My Subjects', to: '/student/subjects', icon: BookOpen },
  { label: 'Mentor notes', to: '/student/mentor-notes', icon: MessageSquare },
  { label: 'Portfolio', to: '/student/portfolio', icon: FolderOpen },
  { label: 'Announcements', to: '/student/announcements', icon: BarChart3 },
  { label: 'Profile', to: '/student/profile', icon: Users },
];

export const MENTOR_NAV: WorkspaceNavItem[] = [
  { label: 'Dashboard', to: '/mentor/dashboard', icon: Home },
  { label: 'Mentees', to: '/mentor/mentees', icon: Users },
  { label: 'Sessions', to: '/mentor/sessions', icon: Video },
];

export const FACULTY_NAV: WorkspaceNavItem[] = [
  { label: 'Dashboard', to: '/faculty/dashboard', icon: Home },
  { label: 'Sessions', to: '/faculty/sessions', icon: Video },
];

export const ADMIN_NAV: WorkspaceNavItem[] = [
  { label: 'Dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Users', to: '/admin/users', icon: Settings },
  { label: 'Students', to: '/admin/students', icon: School },
  { label: 'Offerings', to: '/admin/offerings', icon: BookOpen },
  { label: 'Audit log', to: '/admin/audit-log', icon: ScrollText },
  { label: 'University settings', to: '/admin/settings', icon: SlidersHorizontal },
];

export const HOD_NAV: WorkspaceNavItem[] = [
  { label: 'Dashboard', to: '/hod/dashboard', icon: Home },
  { label: 'Reports', to: '/hod/reports', icon: BarChart3 },
  { label: 'Programs', to: '/hod/programs', icon: FolderOpen },
];

export const PARENT_NAV: WorkspaceNavItem[] = [
  { label: 'Dashboard', to: '/parent/dashboard', icon: Home },
  { label: 'Child progress', to: '/parent/child-progress', icon: BarChart3 },
];

export const COURSE_LEAD_NAV: WorkspaceNavItem[] = [
  { label: 'Dashboard', to: '/course-lead/dashboard', icon: Home },
  { label: 'Offerings', to: '/course-lead/offerings', icon: BookOpen },
  { label: 'Marks verification', to: '/course-lead/marks-verification', icon: ClipboardCheck },
  { label: 'Analytics', to: '/course-lead/analytics', icon: BarChart3 },
];
