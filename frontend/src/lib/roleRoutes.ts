/**
 * Role-based routing configuration
 * Maps user roles to their respective dashboard routes
 */

export const ROLE_HOME: Record<string, string> = {
  STUDENT: '/student/dashboard',
  PARENT: '/parent/dashboard',
  FACULTY: '/faculty/dashboard',
  MENTOR: '/mentor/dashboard',
  HOD: '/hod/dashboard',
  COURSE_LEAD: '/course-lead/dashboard',
  DEAN: '/dean/dashboard',
  REGISTRAR: '/registrar/dashboard',
  TIMETABLE_COORDINATOR: '/timetable/dashboard',
  PLACEMENT_OFFICER: '/placement/dashboard',
  ADMIN: '/admin/dashboard',
};

/**
 * Get the home route for a given role
 * @param role - The user's role
 * @returns The dashboard route for the role, or '/login' if role not found
 */
export function getHomeRoute(role: string): string {
  return ROLE_HOME[role] ?? '/login';
}
