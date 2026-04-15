import { useMemo, type ReactNode } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users,
  AlertTriangle,
  CalendarClock,
  CalendarDays,
  UserX,
  ChevronRight,
  ClipboardList,
} from 'lucide-react';
import api from '../../../services/api';

// ─── API types ───────────────────────────────────────────────────────────────

export interface DashboardStats {
  total_mentees: number;
  pending_followups: number;
  sessions_this_month: number;
  uncontacted_30days: number;
  at_risk_count: number;
  recent_sessions: RecentSessionRow[];
  upcoming_followups: UpcomingFollowupRow[];
}

interface RecentSessionRow {
  session_id: number;
  session_date: string;
  session_type: string;
  student_name: string;
  topics_discussed?: string | null;
}

interface UpcomingFollowupRow {
  session_id: number;
  follow_up_date: string;
  student_name: string;
  student_id: number;
  topics_discussed?: string | null;
  action_items?: string | null;
}

interface MenteeRow {
  assignment_id: number;
  student: {
    student_id: number;
    usn: string;
    full_name: string;
    email: string;
    cgpa: number | null;
    batch_id: number;
    section_id: number | null;
    status?: string;
  };
  at_risk: { attendance: boolean; academic: boolean };
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className ?? ''}`} />;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function formatDate(d: string) {
  try {
    return new Date(d + (d.length <= 10 ? 'T12:00:00' : '')).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function formatSessionType(raw: string) {
  if (!raw) return 'Session';
  const t = raw.replace(/_/g, ' ').toLowerCase();
  return t.replace(/\b\w/g, (c) => c.toUpperCase());
}

function summaryText(topics?: string | null, fallback?: string | null) {
  const s = (topics && topics.trim()) || (fallback && fallback.trim()) || '';
  if (s.length <= 60) return s || '—';
  return `${s.slice(0, 60)}…`;
}

function atRiskPriority(m: MenteeRow): number {
  const { attendance: a, academic: c } = m.at_risk;
  if (a && c) return 3;
  if (a) return 2;
  if (c) return 1;
  return 0;
}

function sortAtRisk(mentees: MenteeRow[]): MenteeRow[] {
  return [...mentees].sort((x, y) => {
    const px = atRiskPriority(x);
    const py = atRiskPriority(y);
    if (py !== px) return py - px;
    return x.student.full_name.localeCompare(y.student.full_name);
  });
}

// ─── components ──────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  icon,
  iconBg,
  onClick,
  valueClass,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  iconBg: string;
  onClick: () => void;
  valueClass?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
        <p className={`mt-0.5 text-2xl font-bold tabular-nums ${valueClass ?? 'text-gray-900'}`}>
          {value}
        </p>
      </div>
    </button>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function MentorDashboardPage() {
  const navigate = useNavigate();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ['mentor-dashboard-stats'],
    queryFn: () => api.get('/mentor/dashboard-stats').then((r) => r.data),
  });

  const { data: mentees = [], isLoading: menteesLoading } = useQuery<MenteeRow[]>({
    queryKey: ['mentor-mentees'],
    queryFn: () => api.get('/mentor/mentees').then((r) => r.data),
  });

  const atRiskMentees = useMemo(() => {
    const flagged = mentees.filter(
      (m) => m.at_risk.attendance || m.at_risk.academic
    );
    return sortAtRisk(flagged);
  }, [mentees]);

  const loading = statsLoading || menteesLoading;

  const s = stats ?? {
    total_mentees: 0,
    pending_followups: 0,
    sessions_this_month: 0,
    uncontacted_30days: 0,
    at_risk_count: 0,
    recent_sessions: [],
    upcoming_followups: [],
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mentor dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Overview of mentees, follow-ups, and recent mentoring activity.
        </p>
      </div>

      {/* A) Stats bar */}
      <section aria-label="Summary statistics">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total assigned mentees"
              value={s.total_mentees}
              icon={<Users className="h-5 w-5 text-blue-600" />}
              iconBg="bg-blue-50"
              onClick={() => navigate('/mentor/mentees')}
            />
            <StatCard
              label="Pending follow-ups"
              value={s.pending_followups}
              icon={<CalendarClock className="h-5 w-5 text-amber-600" />}
              iconBg="bg-amber-50"
              onClick={() => navigate('/mentor/sessions?filter=pending')}
              valueClass={s.pending_followups > 0 ? 'text-amber-700' : 'text-gray-900'}
            />
            <StatCard
              label="Sessions this month"
              value={s.sessions_this_month}
              icon={<CalendarDays className="h-5 w-5 text-violet-600" />}
              iconBg="bg-violet-50"
              onClick={() => navigate('/mentor/sessions?period=month')}
            />
            <StatCard
              label="Uncontacted (30 days)"
              value={s.uncontacted_30days}
              icon={<UserX className="h-5 w-5 text-red-600" />}
              iconBg="bg-red-50"
              onClick={() => navigate('/mentor/mentees?filter=uncontacted')}
              valueClass={s.uncontacted_30days > 0 ? 'text-red-700' : 'text-gray-900'}
            />
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* B) At-risk panel */}
        <section
          id="at-risk-panel"
          aria-label="At-risk mentees"
          className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              <h2 className="text-lg font-bold text-gray-900">At-risk mentees</h2>
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                {s.at_risk_count}
              </span>
            </div>
            <Link
              to="/mentor/mentees?filter=at-risk"
              className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
            >
              View all at-risk
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>

          {menteesLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20" />
              ))}
            </div>
          ) : atRiskMentees.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              No mentees are currently flagged at-risk.
            </p>
          ) : (
            <ul className="space-y-3">
              {atRiskMentees.map((m) => (
                <li key={m.assignment_id}>
                  <button
                    type="button"
                    onClick={() => navigate(`/mentor/mentees/${m.student.student_id}`)}
                    className="flex w-full items-start gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 text-left transition hover:border-primary/25 hover:bg-white"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                      {initials(m.student.full_name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-gray-900">{m.student.full_name}</p>
                      <p className="text-xs text-gray-500">{m.student.usn}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {m.at_risk.attendance && (
                          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">
                            Low attendance
                          </span>
                        )}
                        {m.at_risk.academic && (
                          <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
                            Low CGPA
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-5 w-5 shrink-0 text-gray-300" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* C) Upcoming follow-ups */}
        <section aria-label="Upcoming follow-ups" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-violet-600" />
            <h2 className="text-lg font-bold text-gray-900">Upcoming follow-ups</h2>
            <span className="text-xs text-gray-400">(next 7 days)</span>
          </div>

          {statsLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : s.upcoming_followups.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">No follow-ups scheduled this week.</p>
          ) : (
            <ul className="space-y-4">
              {s.upcoming_followups.map((row) => (
                <li
                  key={row.session_id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-100 bg-gray-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900">{row.student_name}</p>
                    <p className="text-sm text-gray-500">{formatDate(row.follow_up_date)}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {summaryText(row.topics_discussed, row.action_items)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      navigate(`/mentor/sessions/new?studentId=${row.student_id}`)
                    }
                    className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90"
                  >
                    Record session
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* D) Recent activity */}
      <section aria-label="Recent activity" className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-gray-900">Recent activity</h2>
          <Link
            to="/mentor/sessions"
            className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
          >
            View all sessions
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {statsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : s.recent_sessions.length === 0 ? (
          <p className="py-8 text-center text-sm text-gray-500">No sessions recorded yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {s.recent_sessions.map((row) => (
              <li key={row.session_id} className="flex flex-wrap items-center gap-3 py-4 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-gray-900">{row.student_name}</p>
                  <p className="text-sm text-gray-500">{formatDate(row.session_date)}</p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                  {formatSessionType(row.session_type)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
