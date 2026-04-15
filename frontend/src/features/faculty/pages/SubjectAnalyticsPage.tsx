import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ArrowLeft, AlertTriangle, BarChart3 } from 'lucide-react';
import api from '../../../services/api';
import { useAllPermissions } from '../../../hooks/usePermission';

interface DistributionBucket {
  range: string;
  count: number;
}

interface MarksAnalysisItem {
  assessment_id: number;
  title: string;
  max_marks: number;
  class_avg: number | null;
  highest: number | null;
  lowest: number | null;
  std_dev: number | null;
  distribution: DistributionBucket[];
}

interface OfferingInfo {
  subject_name: string | null;
  subject_code: string | null;
  section_id: number | null;
  batch_id: number;
}

interface AttendanceOverviewRow {
  student_id: number;
  usn: string;
  full_name: string;
  attendance_pct: number;
  present: number;
  absent: number;
  total: number;
}

interface AtRiskRow {
  student_id: number;
  usn: string;
  full_name: string;
  risk_type: 'attendance' | 'marks' | 'both';
  attendance_pct: number | null;
  avg_marks_pct: number | null;
}

interface SubjectAnalyticsPayload {
  offering_info: OfferingInfo;
  marks_analysis: MarksAnalysisItem[];
  attendance_overview: AttendanceOverviewRow[];
  at_risk: AtRiskRow[];
}

function pctColor(pct: number): string {
  if (pct >= 75) return 'text-emerald-700 dark:text-emerald-400';
  if (pct >= 60) return 'text-amber-700 dark:text-amber-400';
  return 'text-red-700 dark:text-red-400';
}

function riskBadgeLabel(t: AtRiskRow['risk_type']) {
  if (t === 'both') return 'Both';
  if (t === 'attendance') return 'Low attendance';
  return 'Low marks';
}

export default function SubjectAnalyticsPage() {
  const { offeringId: oidParam } = useParams<{ offeringId: string }>();
  const oid = oidParam ? Number(oidParam) : NaN;
  const canView = useAllPermissions(['MARKS_VIEW_ALL', 'ATTENDANCE_VIEW_ALL']);

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['faculty', 'subjects', oid, 'analytics'],
    queryFn: () => api.get<SubjectAnalyticsPayload>(`/faculty/subjects/${oid}/analytics`).then((r) => r.data),
    enabled: Number.isFinite(oid) && canView,
  });

  const marks = data?.marks_analysis ?? [];

  useEffect(() => {
    const list = data?.marks_analysis;
    if (!list?.length) {
      setSelectedAssessmentId(null);
      return;
    }
    setSelectedAssessmentId((prev) => {
      if (prev != null && list.some((m) => m.assessment_id === prev)) return prev;
      return list[0].assessment_id;
    });
  }, [data]);

  const selectedMarks = useMemo(
    () => marks.find((m) => m.assessment_id === selectedAssessmentId) ?? marks[0] ?? null,
    [marks, selectedAssessmentId],
  );

  const chartData = useMemo(
    () =>
      (selectedMarks?.distribution ?? []).map((d) => ({
        range: d.range,
        count: d.count,
      })),
    [selectedMarks],
  );

  const atRiskIds = useMemo(() => new Set((data?.at_risk ?? []).map((r) => r.student_id)), [data?.at_risk]);

  if (!canView) {
    return <Navigate to="/faculty/dashboard" replace />;
  }

  if (!Number.isFinite(oid)) {
    return <p className="text-red-600">Invalid offering.</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <Link
        to="/faculty/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <header>
        <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
          <BarChart3 className="h-8 w-8 text-primary" />
          Subject analytics
        </h1>
        {data?.offering_info && (
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {data.offering_info.subject_name ?? 'Subject'}{' '}
            {data.offering_info.subject_code && (
              <span className="font-mono text-gray-500">({data.offering_info.subject_code})</span>
            )}
            {' · '}
            Batch {data.offering_info.batch_id}
            {data.offering_info.section_id != null && ` · Section ${data.offering_info.section_id}`}
          </p>
        )}
      </header>

      {isLoading && <div className="animate-pulse rounded-xl bg-gray-100 py-16 dark:bg-gray-800" />}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40">
          Unable to load analytics. You need MARKS_VIEW_ALL and ATTENDANCE_VIEW_ALL, or the offering was not
          found.
        </div>
      )}

      {data && (
        <>
          {/* A) Marks distribution */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Marks distribution</h2>
            {marks.length === 0 ? (
              <p className="text-sm text-gray-500">No assessments for this offering.</p>
            ) : (
              <>
                <label className="mb-4 block text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Assessment</span>
                  <select
                    value={selectedMarks?.assessment_id ?? ''}
                    onChange={(e) => setSelectedAssessmentId(Number(e.target.value))}
                    className="mt-1 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  >
                    {marks.map((m) => (
                      <option key={m.assessment_id} value={m.assessment_id}>
                        {m.title || `Assessment #${m.assessment_id}`}
                      </option>
                    ))}
                  </select>
                </label>

                {selectedMarks && (
                  <>
                    <div className="mb-4 flex flex-wrap gap-6 text-sm">
                      <div>
                        <span className="text-gray-500">Class average</span>
                        <p className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {selectedMarks.class_avg ?? '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Highest</span>
                        <p className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {selectedMarks.highest ?? '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Lowest</span>
                        <p className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {selectedMarks.lowest ?? '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Std dev</span>
                        <p className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {selectedMarks.std_dev ?? '—'}
                        </p>
                      </div>
                      <div>
                        <span className="text-gray-500">Max marks</span>
                        <p className="font-semibold tabular-nums text-gray-900 dark:text-white">
                          {selectedMarks.max_marks}
                        </p>
                      </div>
                    </div>

                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
                          <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              borderRadius: '8px',
                              border: '1px solid #e5e7eb',
                            }}
                          />
                          <Bar dataKey="count" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Students" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      Buckets are % of max marks: 0–20, 21–40, …, 81–100.
                    </p>
                  </>
                )}
              </>
            )}
          </section>

          {/* B) Attendance overview */}
          <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="border-b border-gray-100 px-4 py-3 text-lg font-semibold text-gray-900 dark:border-gray-800 dark:text-white">
              Attendance overview
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left dark:bg-gray-800/80">
                  <tr>
                    <th className="px-4 py-2 font-semibold">USN</th>
                    <th className="px-4 py-2 font-semibold">Name</th>
                    <th className="px-4 py-2 font-semibold text-right">Total sessions</th>
                    <th className="px-4 py-2 font-semibold text-right">Present</th>
                    <th className="px-4 py-2 font-semibold text-right">Absent</th>
                    <th className="px-4 py-2 font-semibold text-right">Attendance %</th>
                    <th className="px-4 py-2 font-semibold">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {data.attendance_overview.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                        No enrolled students or no session data.
                      </td>
                    </tr>
                  ) : (
                    data.attendance_overview.map((row) => (
                      <tr
                        key={row.student_id}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        <td className="px-4 py-2 font-mono">{row.usn}</td>
                        <td className="px-4 py-2">{row.full_name || '—'}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.total}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.present}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{row.absent}</td>
                        <td className={`px-4 py-2 text-right font-semibold tabular-nums ${pctColor(row.attendance_pct)}`}>
                          {row.attendance_pct.toFixed(1)}%
                        </td>
                        <td className="px-4 py-2">
                          {atRiskIds.has(row.student_id) ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
                              <AlertTriangle className="h-3 w-3" />
                              At risk
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* C) At-risk */}
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">At-risk students</h2>
            {data.at_risk.length === 0 ? (
              <p className="text-sm text-gray-500">No students flagged (attendance &lt; 75% or avg marks % &lt; 40).</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {data.at_risk.map((r) => (
                  <div
                    key={r.student_id}
                    className="rounded-lg border border-amber-200 bg-amber-50/80 p-4 dark:border-amber-900/50 dark:bg-amber-950/30"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{r.full_name || '—'}</p>
                        <p className="font-mono text-xs text-gray-600 dark:text-gray-400">{r.usn}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-amber-200 px-2 py-0.5 text-xs font-semibold text-amber-950 dark:bg-amber-800 dark:text-amber-100">
                        {riskBadgeLabel(r.risk_type)}
                      </span>
                    </div>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <dt className="text-gray-500">Attendance</dt>
                        <dd className="font-medium tabular-nums">
                          {r.attendance_pct != null ? `${r.attendance_pct.toFixed(1)}%` : '—'}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-gray-500">Avg marks %</dt>
                        <dd className="font-medium tabular-nums">
                          {r.avg_marks_pct != null ? `${r.avg_marks_pct.toFixed(1)}%` : '—'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
