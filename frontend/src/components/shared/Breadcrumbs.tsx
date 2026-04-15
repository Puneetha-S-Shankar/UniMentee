import { Link, useLocation } from 'react-router-dom';

const SEGMENT_LABELS: Record<string, string> = {
  student: 'Student',
  mentor: 'Mentor',
  faculty: 'Faculty',
  admin: 'Admin',
  hod: 'HOD',
  parent: 'Parent',
  'course-lead': 'Course lead',
  dashboard: 'Dashboard',
  attendance: 'Attendance',
  subjects: 'Subjects',
  performance: 'Performance',
  marks: 'Marks',
  'mentor-notes': 'Mentor notes',
  profile: 'Profile',
  portfolio: 'Portfolio',
  announcements: 'Announcements',
  sessions: 'Sessions',
  mentees: 'Mentees',
  users: 'Users',
  students: 'Students',
  programs: 'Programs',
  reports: 'Reports',
  analytics: 'Analytics',
};

function labelFor(segment: string): string {
  return SEGMENT_LABELS[segment] ?? segment.replace(/-/g, ' ');
}

export default function Breadcrumbs() {
  const { pathname } = useLocation();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) return null;

  const crumbs: { to: string; label: string }[] = [];
  let acc = '';
  for (const seg of segments) {
    acc += `/${seg}`;
    crumbs.push({ to: acc, label: labelFor(seg) });
  }

  return (
    <nav aria-label="Breadcrumb" className="mb-4 text-sm text-gray-500 dark:text-gray-400">
      <ol className="flex flex-wrap items-center gap-1">
        <li>
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
        </li>
        {crumbs.map((c, i) => (
          <li key={c.to} className="flex items-center gap-1">
            <span className="text-gray-300 dark:text-gray-600">/</span>
            {i === crumbs.length - 1 ? (
              <span className="font-medium text-gray-800 dark:text-gray-200">{c.label}</span>
            ) : (
              <Link to={c.to} className="hover:text-primary">
                {c.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
