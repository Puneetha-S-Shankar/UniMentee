import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  ClipboardCheck,
  GraduationCap,
  Layers,
  ScrollText,
  Settings,
  UserPlus,
  Users,
} from 'lucide-react';
import api from '../../../services/api';
import { useAnyPermission } from '../../../hooks/usePermission';
import { useAuthStore } from '../../../stores/authStore';

export interface AnalyticsSummary {
  total_students: number;
  total_faculty: number;
  at_risk_students: number;
  low_attendance_students: number;
  active_offerings: number;
  pending_portfolio_verifications: number;
  pending_mark_verifications: number;
  total_users: number;
  current_term_enrollment: number;
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800 ${className ?? ''}`} />
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-gray-900 dark:text-white">
            {value}
          </p>
          {sub ? (
            <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">{sub}</p>
          ) : null}
        </div>
        <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const canView =
    useAnyPermission(['ORG_VIEW', 'USER_VIEW', 'DEPT_VIEW']) || roles.includes('HOD');

  const summaryQuery = useQuery({
    queryKey: ['admin', 'analytics', 'summary'],
    queryFn: () => api.get<AnalyticsSummary>('/admin/analytics/summary').then((r) => r.data),
    enabled: canView,
  });

  const s = summaryQuery.data;

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Access denied</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You need organization or user analytics permissions to view this dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Admin dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          University-wide metrics, alerts, and shortcuts.
        </p>
      </div>

      {/* A) System metrics */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          System metrics
        </h2>
        {summaryQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : summaryQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            Could not load analytics. Check your permissions (ORG_VIEW or USER_VIEW) and try again.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total active students"
              value={s?.total_students ?? '—'}
              icon={GraduationCap}
            />
            <StatCard label="Total faculty" value={s?.total_faculty ?? '—'} icon={Users} />
            <StatCard
              label="Active subject offerings"
              value={s?.active_offerings ?? '—'}
              icon={BookOpen}
            />
            <StatCard
              label="Enrollment (current term)"
              value={s?.current_term_enrollment ?? '—'}
              icon={Layers}
              sub="Placeholder: sum of seats on active offerings until term scoping is enabled."
            />
            <StatCard
              label="Low attendance alerts"
              value={s?.low_attendance_students ?? '—'}
              icon={AlertTriangle}
            />
            <StatCard label="Total users" value={s?.total_users ?? '—'} icon={Users} />
          </div>
        )}
      </section>

      {/* B) Critical alerts */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Critical alerts
        </h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Link
            to="/admin/portfolio"
            className="group flex flex-col rounded-xl border border-amber-200 bg-amber-50/80 p-5 shadow-sm transition hover:border-amber-300 dark:border-amber-900/60 dark:bg-amber-950/30"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/50 dark:text-amber-100">
                Portfolio
              </span>
              <ArrowRight className="h-4 w-4 text-amber-700 opacity-0 transition group-hover:opacity-100 dark:text-amber-300" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
              {s?.pending_portfolio_verifications ?? '—'}
            </p>
            <p className="mt-1 text-sm text-amber-900/80 dark:text-amber-100/80">
              Pending portfolio verifications
            </p>
          </Link>

          <Link
            to="/admin/offerings"
            className="group flex flex-col rounded-xl border border-blue-200 bg-blue-50/80 p-5 shadow-sm transition hover:border-blue-300 dark:border-blue-900/60 dark:bg-blue-950/30"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-900 dark:bg-blue-900/50 dark:text-blue-100">
                Assessments
              </span>
              <ArrowRight className="h-4 w-4 text-blue-700 opacity-0 transition group-hover:opacity-100 dark:text-blue-300" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
              {s?.pending_mark_verifications ?? '—'}
            </p>
            <p className="mt-1 text-sm text-blue-900/80 dark:text-blue-100/80">
              Assessments awaiting verification (course leads)
            </p>
          </Link>

          <Link
            to="/admin/analytics"
            className="group flex flex-col rounded-xl border border-red-200 bg-red-50/80 p-5 shadow-sm transition hover:border-red-300 dark:border-red-900/60 dark:bg-red-950/30"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-900 dark:bg-red-900/50 dark:text-red-100">
                At risk
              </span>
              <ArrowRight className="h-4 w-4 text-red-700 opacity-0 transition group-hover:opacity-100 dark:text-red-300" />
            </div>
            <p className="mt-3 text-2xl font-semibold text-gray-900 dark:text-white">
              {s?.at_risk_students ?? '—'}
            </p>
            <p className="mt-1 text-sm text-red-900/80 dark:text-red-100/80">
              At-risk students (CGPA below warning threshold)
            </p>
          </Link>
        </div>
      </section>

      {/* C) Quick actions */}
      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Quick actions
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { to: '/admin/students/new', label: 'Create student', icon: UserPlus },
            { to: '/admin/users/new', label: 'Create user', icon: Users },
            { to: '/admin/offerings', label: 'Manage offerings', icon: BookOpen },
            { to: '/admin/mentor-assignments', label: 'Mentor assignments', icon: ClipboardCheck },
            { to: '/admin/audit-log', label: 'View audit log', icon: ScrollText },
            { to: '/admin/settings', label: 'University settings', icon: Settings },
          ].map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-center gap-4 rounded-xl border border-gray-200 bg-white px-5 py-4 font-medium text-gray-900 shadow-sm transition hover:border-primary/40 hover:bg-primary/5 dark:border-gray-800 dark:bg-gray-900 dark:text-white dark:hover:bg-gray-800"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1">{label}</span>
              <ArrowRight className="h-4 w-4 text-gray-400 opacity-0 transition group-hover:opacity-100" />
            </Link>
          ))}
        </div>
      </section>

      {/* Footer note */}
      <p className="text-center text-xs text-gray-400 dark:text-gray-500">
        Data from GET <code className="rounded bg-gray-100 px-1 py-0.5 dark:bg-gray-800">/admin/analytics/summary</code>
      </p>
    </div>
  );
}
