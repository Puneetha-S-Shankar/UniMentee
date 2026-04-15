import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar, Loader2 } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';
import type { FacultySubject } from './FacultyDashboardPage';

interface AttendanceSessionOut {
  session_id: number;
  offering_id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  session_type: string;
  topic_covered?: string | null;
  is_locked: boolean;
  total_present: number | null;
}

type SessionRow = AttendanceSessionOut & {
  subject_label: string;
};

function isoDate(val: string): string {
  return val.slice(0, 10);
}

function timeShort(t: string): string {
  return t?.slice(0, 5) ?? '—';
}

export default function FacultySessionsPage() {
  const hasAttendance = usePermission('ATTENDANCE_MARK');
  const hasMarks = usePermission('MARKS_ENTER');
  const canAccess = hasAttendance || hasMarks;

  useEffect(() => {
    console.log('[FacultySessionsPage] render/mount', { canAccess, hasAttendance, hasMarks });
  }, [canAccess, hasAttendance, hasMarks]);

  const subjectsQuery = useQuery({
    queryKey: ['faculty', 'subjects', 'all'],
    queryFn: async () => {
      console.log('[FacultySessionsPage] fetch: GET /faculty/subjects');
      const { data } = await api.get<FacultySubject[]>('/faculty/subjects');
      console.log('[FacultySessionsPage] fetch: /faculty/subjects done', { count: data?.length ?? 0 });
      return data;
    },
    enabled: canAccess,
  });

  const activeOfferingIds = useMemo(
    () => (subjectsQuery.data ?? []).filter((s) => s.status === 'ACTIVE').map((s) => s.offering_id),
    [subjectsQuery.data],
  );

  const offeringLabel = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of subjectsQuery.data ?? []) {
      m.set(s.offering_id, s.subject_name ?? s.subject_code ?? `Offering #${s.offering_id}`);
    }
    return m;
  }, [subjectsQuery.data]);

  const sessionQueries = useQueries({
    queries: activeOfferingIds.map((offeringId) => ({
      queryKey: ['attendance', 'offerings', offeringId, 'sessions'] as const,
      queryFn: async () => {
        console.log('[FacultySessionsPage] fetch: GET /attendance/offerings/' + offeringId + '/sessions');
        const { data } = await api.get<AttendanceSessionOut[]>(
          `/attendance/offerings/${offeringId}/sessions`,
        );
        console.log('[FacultySessionsPage] fetch: sessions for offering', offeringId, { count: data?.length ?? 0 });
        return data;
      },
      enabled: canAccess && activeOfferingIds.length > 0 && subjectsQuery.isSuccess,
    })),
  });

  const rows: SessionRow[] = useMemo(() => {
    const list: SessionRow[] = [];
    activeOfferingIds.forEach((oid, i) => {
      const sessions = sessionQueries[i]?.data;
      if (!sessions) return;
      const label = offeringLabel.get(oid) ?? `Offering #${oid}`;
      for (const s of sessions) {
        list.push({ ...s, subject_label: label });
      }
    });
    list.sort((a, b) => {
      const da = isoDate(a.session_date).localeCompare(isoDate(b.session_date));
      if (da !== 0) return -da;
      return timeShort(b.start_time).localeCompare(timeShort(a.start_time));
    });
    return list;
  }, [activeOfferingIds, sessionQueries, offeringLabel]);

  const loadingSessions =
    activeOfferingIds.length > 0 && sessionQueries.some((q) => q.isLoading || q.isFetching);

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
          <p className="font-medium">You don&apos;t have access to faculty sessions.</p>
          <p className="mt-1 text-sm opacity-90">
            Required: at least one of ATTENDANCE_MARK or MARKS_ENTER (same as the faculty dashboard).
          </p>
        </div>
      </div>
    );
  }

  if (subjectsQuery.isError) {
    return (
      <div className="mx-auto max-w-4xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Could not load subjects. Check your network or try again later.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          to="/faculty/dashboard"
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to dashboard
        </Link>
      </div>

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faculty sessions</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Attendance class sessions across your active subject offerings.
        </p>
      </header>

      {subjectsQuery.isLoading ? (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your subjects…
        </div>
      ) : activeOfferingIds.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
          No active offerings found. Sessions are listed per subject you lead.
        </p>
      ) : loadingSessions ? (
        <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading sessions…
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-gray-600 dark:border-gray-700 dark:text-gray-400">
          No sessions recorded yet. Open a subject to start a session.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
          <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
            <thead className="bg-gray-50 dark:bg-gray-800/80">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Date</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Time</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Type</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Topic</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Subject</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Present</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 dark:text-gray-200">Locked</th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.map((r) => (
                <tr key={r.session_id}>
                  <td className="px-4 py-3 tabular-nums text-gray-900 dark:text-white">{isoDate(r.session_date)}</td>
                  <td className="px-4 py-3 tabular-nums text-gray-700 dark:text-gray-300">
                    {timeShort(r.start_time)} – {timeShort(r.end_time)}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.session_type}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-gray-700 dark:text-gray-300" title={r.topic_covered ?? ''}>
                    {r.topic_covered?.trim() || '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">{r.subject_label}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-gray-300">
                    {r.total_present ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{r.is_locked ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={`/faculty/subjects/${r.offering_id}/attendance`}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-primary hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                    >
                      <Calendar className="h-3.5 w-3.5" />
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
