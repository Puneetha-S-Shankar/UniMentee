import type { ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Layers,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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

interface OfferingOut {
  offering_id: number;
  curriculum_id: number;
  batch_id: number;
  section_id: number | null;
  academic_year_id: number;
  term_id: number;
  status: string;
  current_enrollment: number;
  max_enrollment: number | null;
  version: number;
}

interface AdminUserOut {
  user_id: number;
  full_name: string;
  email: string;
  status: string;
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
  icon: ComponentType<{ className?: string }>;
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

function useHodWorkspaceAccess() {
  const roles = useAuthStore((s) => s.user?.roles ?? []);
  const perm = useAnyPermission(['ORG_VIEW', 'USER_VIEW', 'DEPT_VIEW']);
  return perm || roles.includes('HOD');
}

export default function HODDashboardPage() {
  const canView = useHodWorkspaceAccess();

  const summaryQuery = useQuery({
    queryKey: ['admin', 'analytics', 'summary', 'hod'],
    queryFn: () => api.get<AnalyticsSummary>('/admin/analytics/summary').then((r) => r.data),
    enabled: canView,
  });

  const offeringsQuery = useQuery({
    queryKey: ['academic', 'offerings', 'hod'],
    queryFn: () => api.get<OfferingOut[]>('/academic/offerings').then((r) => r.data),
    enabled: canView,
  });

  const facultyQuery = useQuery({
    queryKey: ['admin', 'users', 'faculty', 'hod'],
    queryFn: () =>
      api
        .get<AdminUserOut[]>('/admin/users', { params: { role: 'FACULTY', status: 'ACTIVE' } })
        .then((r) => r.data),
    enabled: canView,
  });

  const s = summaryQuery.data;

  const riskChartData =
    s != null
      ? [
          { label: 'At-risk (CGPA)', value: s.at_risk_students },
          { label: 'Low attendance', value: s.low_attendance_students },
        ]
      : [];

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Access denied</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You need department analytics access (DEPT_VIEW), organization view, or the HOD role.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Department dashboard</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          University-wide metrics are shown as a department proxy until scoped analytics are enabled.
        </p>
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Department metrics
        </h2>
        {summaryQuery.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : summaryQuery.isError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            Could not load analytics. Check permissions and try again.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              label="Total faculty"
              value={s?.total_faculty ?? '—'}
              icon={Users}
              sub="Active users with FACULTY role (university-wide)"
            />
            <StatCard
              label="Active offerings"
              value={s?.active_offerings ?? '—'}
              icon={BookOpen}
              sub="From analytics summary (university-wide until department scope exists)"
            />
            <StatCard
              label="Enrolled students (seats)"
              value={s?.current_term_enrollment ?? '—'}
              icon={Layers}
              sub="Sum of current_enrollment on active offerings"
            />
          </div>
        )}
        <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
          Academic offerings loaded for future department filtering:{' '}
          {offeringsQuery.isLoading
            ? '…'
            : offeringsQuery.isError
              ? 'could not load'
              : `${(offeringsQuery.data ?? []).length} total (not yet scoped to department)`}
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">At-risk snapshot</h3>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Uses the same definitions as the admin analytics summary.
          </p>
          {s && riskChartData.length > 0 ? (
            <div className="mt-4 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={riskChartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No data to chart.</p>
          )}
          <Link
            to="/admin/dashboard"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            Open admin analytics area
            <ArrowRight className="h-4 w-4" />
          </Link>
          <p className="mt-1 text-xs text-gray-400">
            Tip: use <Link to="/admin/analytics" className="text-primary hover:underline">/admin/analytics</Link> when
            that view is wired.
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-5 dark:border-amber-900/50 dark:bg-amber-950/30">
          <div className="flex gap-2">
            <AlertTriangle className="h-5 w-5 shrink-0 text-amber-700 dark:text-amber-400" />
            <div>
              <h3 className="text-sm font-semibold text-amber-950 dark:text-amber-100">At-risk summary</h3>
              <p className="mt-1 text-sm text-amber-900/90 dark:text-amber-200/90">
                Combined at-risk signal:{' '}
                <span className="font-semibold">{s?.at_risk_students ?? '—'}</span> students below CGPA warning
                threshold, and{' '}
                <span className="font-semibold">{s?.low_attendance_students ?? '—'}</span> with low attendance.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Faculty workload
        </h2>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/80">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Faculty</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Theory hrs/wk</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Lab hrs/wk</th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Overload</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
              {facultyQuery.isLoading ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-500">
                    Loading faculty…
                  </td>
                </tr>
              ) : facultyQuery.isError ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-sm text-red-600">
                    Could not load faculty directory.
                  </td>
                </tr>
              ) : (
                (facultyQuery.data ?? []).map((f) => (
                  <tr key={f.user_id}>
                    <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{f.full_name}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">—</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">—</td>
                    <td className="px-4 py-3 text-center text-sm text-gray-400">—</td>
                  </tr>
                ))
              )}
              <tr className="bg-gray-50/80 dark:bg-gray-800/40">
                <td colSpan={4} className="px-4 py-3 text-center text-xs text-gray-500 dark:text-gray-400">
                  Workload data coming soon — /faculty/workload currently reflects the signed-in faculty member only.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
