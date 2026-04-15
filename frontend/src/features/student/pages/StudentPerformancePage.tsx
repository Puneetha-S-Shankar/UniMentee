import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import html2canvas from 'html2canvas';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';

// ─── Types ───────────────────────────────────────────────────────────────────

interface AcademicTerm {
  term_id: number;
  name: string;
  academic_year_id: number;
  is_current: boolean;
}

interface ProgressRow {
  term_id: number;
  semester_number: number;
  sgpa: number | null;
  cgpa: number | null;
  sgpa_status: string;
}

/** Matches backend `AssessmentMarkDetail` for GET /students/me/marks */
interface AssessmentMarkDetail {
  assessment_id: number;
  title: string;
  max_marks: number;
  marks_obtained: number | null;
  is_absent: boolean;
  percentage: number | null;
  status: string;
}

/** Matches backend `OfferingMarks` — nested per offering */
interface OfferingMarks {
  offering_id: number;
  subject_name?: string | null;
  assessments: AssessmentMarkDetail[];
}

type FlattenedMarkRow = AssessmentMarkDetail & {
  offering_id: number;
  subject_name?: string | null;
};

interface GradeScaleRow {
  grade: string;
  grade_point: number;
  min_percentage: number;
  max_percentage: number;
  is_passing: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeLetterForPercentage(
  pct: number | null | undefined,
  scales: GradeScaleRow[],
): string {
  if (pct == null || Number.isNaN(pct)) return '—';
  const row = scales.find(s => pct >= s.min_percentage && pct <= s.max_percentage);
  return row?.grade ?? '—';
}

function pctColorClass(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return 'text-gray-400';
  if (pct >= 60) return 'text-emerald-700 font-semibold';
  if (pct >= 40) return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
}

function offeringDisplayLabel(o: Pick<OfferingMarks, 'offering_id' | 'subject_name'>): string {
  const name = o.subject_name?.trim();
  return name || `#${o.offering_id}`;
}

function flattenOfferingMarks(data: OfferingMarks[]): FlattenedMarkRow[] {
  return data.flatMap(subject =>
    (subject.assessments ?? []).map(a => ({
      offering_id: subject.offering_id,
      subject_name: subject.subject_name ?? null,
      ...a,
    })),
  );
}

/** Demo chart: mean assessment % per offering (frontend-only; ignores null / missing percentages). */
function buildPerformanceTrendFromMarks(
  marksData: OfferingMarks[],
): { subjectLabel: string; average: number }[] {
  return (marksData ?? []).map(subject => {
    const nums = (subject.assessments ?? [])
      .map(a => a.percentage)
      .filter((p): p is number => p != null && Number.isFinite(Number(p)))
      .map(Number);
    const avg = nums.length === 0 ? 0 : nums.reduce((sum, p) => sum + p, 0) / nums.length;
    return {
      subjectLabel: offeringDisplayLabel(subject),
      average: Number(avg.toFixed(1)),
    };
  });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TermSelector({
  terms,
  value,
  onChange,
  disabled,
}: {
  terms: AcademicTerm[];
  value: number | null;
  onChange: (termId: number) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5 max-w-xs">
      <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Term</span>
      <select
        className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
        value={value ?? ''}
        disabled={disabled || !terms.length}
        onChange={e => onChange(Number(e.target.value))}
      >
        {!terms.length ? (
          <option value="">No terms</option>
        ) : (
          terms.map(t => (
            <option key={t.term_id} value={t.term_id}>
              {t.name}
              {t.is_current ? ' (current)' : ''}
            </option>
          ))
        )}
      </select>
    </label>
  );
}

function PerformanceTrendChart({
  trendData,
  chartRef,
  onDownloadPng,
  marksReady,
}: {
  trendData: { subjectLabel: string; average: number }[];
  chartRef: React.RefObject<HTMLDivElement | null>;
  onDownloadPng: () => void;
  marksReady: boolean;
}) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-base font-extrabold text-gray-900">Performance trend</h2>
          <p className="mt-1 text-xs text-gray-500">
            Average assessment % per offering (from published marks — demo view).
          </p>
        </div>
        <button
          type="button"
          onClick={onDownloadPng}
          className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-bold text-gray-700 hover:bg-gray-100"
        >
          Download PNG
        </button>
      </div>
      <div ref={chartRef} className="rounded-lg bg-white p-2">
        {!marksReady ? (
          <p className="py-12 text-center text-sm text-gray-400">Loading marks…</p>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={trendData}
              margin={{ top: 8, right: 16, left: 4, bottom: 48 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                dataKey="subjectLabel"
                tick={{ fontSize: 10 }}
                interval={0}
                angle={-25}
                textAnchor="end"
                height={56}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fontSize: 11 }}
                width={44}
                label={{ value: '%', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const row = payload[0].payload as { subjectLabel: string; average: number };
                  return (
                    <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-md">
                      <p className="font-semibold text-gray-900">{row.subjectLabel}</p>
                      <p className="mt-0.5 text-gray-600">
                        Average: <span className="font-bold tabular-nums">{row.average}%</span>
                      </p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="average" name="Average %" fill="#2563eb" radius={[4, 4, 0, 0]} maxBarSize={56} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function MarksTable({
  rows,
  gradeScales,
}: {
  rows: FlattenedMarkRow[];
  gradeScales: GradeScaleRow[];
}) {
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) =>
          a.offering_id - b.offering_id ||
          a.assessment_id - b.assessment_id ||
          a.title.localeCompare(b.title),
      ),
    [rows],
  );

  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm overflow-x-auto">
      <h2 className="mb-4 text-base font-extrabold text-gray-900">Subject marks</h2>
      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400">No assessments for this term</p>
      ) : (
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
              <th className="pb-2 pr-2">Subject</th>
              <th className="pb-2 pr-2">Assessment</th>
              <th className="pb-2 pr-2 text-right">Max marks</th>
              <th className="pb-2 pr-2 text-right">Marks obtained</th>
              <th className="pb-2 pr-2 text-right">%</th>
              <th className="pb-2">Grade</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const published = row.status === 'PUBLISHED';
              return (
                <tr
                  key={`${row.offering_id}-${row.assessment_id}`}
                  className="border-b border-gray-100 bg-white"
                >
                  <td
                    className="py-2.5 pr-2 text-gray-900"
                    title={`Offering #${row.offering_id}`}
                  >
                    {offeringDisplayLabel(row)}
                  </td>
                  <td className="py-2.5 pr-2 text-gray-800">{row.title || '—'}</td>
                  <td className="py-2.5 pr-2 text-right tabular-nums text-gray-800">
                    {row.max_marks}
                  </td>
                  <td className="py-2.5 pr-2 text-right tabular-nums">
                    {!published ? (
                      <span className="italic text-gray-400">Not published</span>
                    ) : row.is_absent ? (
                      <span className="text-gray-500">Absent</span>
                    ) : (
                      <span className="text-gray-800">
                        {row.marks_obtained != null ? row.marks_obtained : '—'}
                      </span>
                    )}
                  </td>
                  <td
                    className={`py-2.5 pr-2 text-right tabular-nums ${pctColorClass(published ? row.percentage : null)}`}
                  >
                    {!published ? (
                      <span className="italic text-gray-400">—</span>
                    ) : row.percentage != null ? (
                      `${Number(row.percentage).toFixed(1)}%`
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="py-2.5 font-medium text-gray-800">
                    {!published ? (
                      <span className="italic text-gray-400">—</span>
                    ) : (
                      gradeLetterForPercentage(row.percentage, gradeScales)
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function GradeScaleLegend({
  scales,
  isLoading,
  isError,
}: {
  scales: GradeScaleRow[];
  isLoading: boolean;
  isError: boolean;
}) {
  if (isLoading) {
    return (
      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-extrabold text-gray-900">Grade scale</h2>
        <p className="text-xs text-gray-400">Loading…</p>
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm">
        <h2 className="mb-3 text-sm font-extrabold text-red-900">Grade scale</h2>
        <p className="text-xs text-red-800">Could not load grade scale. Please try again later.</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-sm font-extrabold text-gray-900">Grade scale</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[240px] border-collapse text-xs">
          <thead>
            <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">
              <th className="pb-2 pr-2">Grade</th>
              <th className="pb-2 pr-2">Range</th>
              <th className="pb-2 text-right">Points</th>
            </tr>
          </thead>
          <tbody className="text-gray-800">
            {scales.map(s => (
              <tr key={`${s.grade}-${s.min_percentage}`} className="border-b border-gray-50 last:border-0">
                <td className="py-2 pr-2 font-bold">{s.grade}</td>
                <td className="py-2 pr-2 tabular-nums text-gray-600">
                  {s.min_percentage}%–{s.max_percentage}%
                </td>
                <td className="py-2 text-right tabular-nums font-medium">{s.grade_point}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AcademicStandingBadge({ cgpa }: { cgpa: number | null }) {
  const tip =
    'Academic standing uses your latest CGPA: Good standing ≥ 7.5; Warning 5.5–7.4; Probation below 5.5.';

  if (cgpa == null) {
    return (
      <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-bold text-gray-500">
        No CGPA data
      </span>
    );
  }

  const level = cgpa >= 7.5 ? 'GOOD_STANDING' : cgpa >= 5.5 ? 'WARNING' : 'PROBATION';
  const label =
    level === 'GOOD_STANDING' ? 'Good standing' : level === 'WARNING' ? 'Warning' : 'Probation';

  const cls =
    level === 'GOOD_STANDING'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
      : level === 'WARNING'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-red-200 bg-red-50 text-red-800';

  return (
    <span
      title={tip}
      className={`inline-flex cursor-help rounded-full border px-3 py-1 text-xs font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentPerformancePage() {
  const canView = usePermission('MARKS_VIEW_OWN');
  const [selectedTermId, setSelectedTermId] = useState<number | null>(null);
  const chartRef = useRef<HTMLDivElement>(null);

  const { data: terms = [], isLoading: termsLoading } = useQuery<AcademicTerm[]>({
    queryKey: ['academic-terms'],
    queryFn: () => api.get('/academic/terms').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: canView,
  });

  const {
    data: gradeScales = [],
    isLoading: scalesLoading,
    isError: scalesError,
  } = useQuery<GradeScaleRow[]>({
    queryKey: ['grade-scales'],
    queryFn: () => api.get('/academic/grade-scales').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: canView,
  });

  const { data: progress = [], isLoading: progressLoading } = useQuery<ProgressRow[]>({
    queryKey: ['student-progress'],
    queryFn: () => api.get('/students/me/progress').then(r => r.data),
    staleTime: 60_000,
    enabled: canView,
  });

  useEffect(() => {
    if (selectedTermId != null) return;
    const cur = terms.find(t => t.is_current);
    if (cur) {
      setSelectedTermId(cur.term_id);
      return;
    }
    if (terms.length) {
      setSelectedTermId(terms[0].term_id);
      return;
    }
    if (progress.length) {
      const last = [...progress].sort((a, b) => b.semester_number - a.semester_number)[0];
      setSelectedTermId(last.term_id);
    }
  }, [terms, progress, selectedTermId]);

  const { data: marksByOffering = [], isLoading: marksLoading } = useQuery<OfferingMarks[]>({
    queryKey: ['student-marks', selectedTermId],
    queryFn: () =>
      api.get('/students/me/marks', { params: { term_id: selectedTermId } }).then(r => r.data),
    staleTime: 60_000,
    enabled: canView && selectedTermId != null,
  });

  const flattenedMarks = useMemo(() => flattenOfferingMarks(marksByOffering), [marksByOffering]);

  const performanceTrendData = useMemo(
    () => buildPerformanceTrendFromMarks(marksByOffering),
    [marksByOffering],
  );

  const latestCgpa = useMemo(() => {
    if (!progress.length) return null;
    const top = [...progress].sort((a, b) => b.semester_number - a.semester_number)[0];
    return top.cgpa != null ? Number(top.cgpa) : null;
  }, [progress]);

  const downloadPng = useCallback(async () => {
    if (!chartRef.current) return;
    const canvas = await html2canvas(chartRef.current, { backgroundColor: '#ffffff', scale: 2 });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = 'performance-trend.png';
    a.click();
  }, []);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm font-medium text-amber-900">
        You do not have permission to view academic performance (MARKS_VIEW_OWN).
      </div>
    );
  }

  const pageBusy = termsLoading || scalesLoading || progressLoading || (selectedTermId != null && marksLoading);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Performance</h1>
          {/* <p className="mt-1 text-sm text-gray-500">SGPA, CGPA, and term-wise marks</p> */}
        </div>
        <AcademicStandingBadge cgpa={latestCgpa} />
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <TermSelector
          terms={terms}
          value={selectedTermId}
          onChange={setSelectedTermId}
          disabled={termsLoading}
        />
        {pageBusy && (
          <span className="text-xs font-medium text-gray-400">Loading…</span>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-6">
          <PerformanceTrendChart
            trendData={performanceTrendData}
            chartRef={chartRef}
            onDownloadPng={downloadPng}
            marksReady={selectedTermId != null && !marksLoading}
          />
          <MarksTable rows={flattenedMarks} gradeScales={gradeScales} />
        </div>
        <div>
          <GradeScaleLegend scales={gradeScales} isLoading={scalesLoading} isError={scalesError} />
        </div>
      </div>
    </div>
  );
}
