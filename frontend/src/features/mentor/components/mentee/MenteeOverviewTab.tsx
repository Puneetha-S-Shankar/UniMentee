import { useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { ClipboardList, Calendar, TrendingUp, AlertCircle } from 'lucide-react';
import type { AcademicSummary, MentorSessionRow } from './types';

function avgAttendancePct(summaries: { percentage: number }[]): number | null {
  if (!summaries.length) return null;
  const sum = summaries.reduce((a, b) => a + b.percentage, 0);
  return Math.round((sum / summaries.length) * 100) / 100;
}

function countPendingFollowups(sessions: MentorSessionRow[]): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let n = 0;
  for (const s of sessions) {
    if (!s.follow_up_required || !s.follow_up_date) continue;
    const fu = new Date(s.follow_up_date + 'T12:00:00');
    if (fu >= today) continue;
    const newer = sessions.some(
      (o) =>
        o.assignment_id === s.assignment_id &&
        o.session_id !== s.session_id &&
        new Date(o.session_date + 'T12:00:00') >= fu,
    );
    if (!newer) n += 1;
  }
  return n;
}

export function MenteeOverviewTab({
  academicSummary,
  academicLoading,
  attendanceSummaries,
  sessions,
}: {
  academicSummary: AcademicSummary | undefined;
  academicLoading: boolean;
  attendanceSummaries: { percentage: number }[];
  sessions: MentorSessionRow[];
}) {
  useEffect(() => {
    if (academicSummary == null) return;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[MenteeOverviewTab] academic-summary', {
        latest_sgpa: academicSummary.latest_sgpa,
        cgpa: academicSummary.cgpa,
        trend: academicSummary.trend,
      });
    }
  }, [academicSummary]);

  const latestSgpa = academicSummary?.latest_sgpa ?? null;

  const attAvg = avgAttendancePct(attendanceSummaries);
  const pendingFu = countPendingFollowups(sessions);

  const chartData = useMemo(() => {
    const trend = academicSummary?.trend ?? [];
    return trend.map((p) => ({
      label: p.term,
      sgpa: p.sgpa,
    }));
  }, [academicSummary?.trend]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
            <TrendingUp className="h-4 w-4 text-violet-500" />
            Latest SGPA
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {academicLoading ? (
              <span className="text-gray-400">…</span>
            ) : latestSgpa != null ? (
              latestSgpa.toFixed(2)
            ) : (
              '—'
            )}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
            <Calendar className="h-4 w-4 text-emerald-500" />
            Overall attendance
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {attAvg != null ? `${attAvg}%` : '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">Average across enrolled subjects</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
            <ClipboardList className="h-4 w-4 text-blue-500" />
            Sessions recorded
          </div>
          <p className="text-3xl font-bold text-gray-900">{sessions.length}</p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
          <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-gray-400">
            <AlertCircle className="h-4 w-4 text-amber-500" />
            Pending follow-ups
          </div>
          <p className={`text-3xl font-bold ${pendingFu > 0 ? 'text-amber-700' : 'text-gray-900'}`}>
            {pendingFu}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-extrabold text-gray-900">SGPA trend</h3>
        {academicLoading ? (
          <p className="py-12 text-center text-sm text-gray-400">Loading academic data…</p>
        ) : chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-400">No progress records yet</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fontSize: 11 }} width={36} />
              <Tooltip
                formatter={(v: number | string) =>
                  v == null || v === '' ? '—' : typeof v === 'number' ? v.toFixed(2) : v
                }
              />
              <Line type="monotone" dataKey="sgpa" name="SGPA" stroke="#7c3aed" strokeWidth={2} dot />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
