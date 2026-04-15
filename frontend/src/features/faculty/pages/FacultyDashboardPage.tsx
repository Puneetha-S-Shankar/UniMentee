import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Calendar,
  ClipboardList,
  FileText,
  Lock,
  School,
} from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';

// ─── types ───────────────────────────────────────────────────────────────────

export interface FacultySubject {
  offering_id: number;
  batch_id: number;
  section_id: number | null;
  term_id: number;
  status: string;
  current_enrollment: number;
  max_enrollment: number | null;
  subject_code: string | null;
  subject_name: string | null;
  credits: number | null;
  subject_type: string | null;
}

interface AssessmentRow {
  assessment_id: number;
  offering_id: number;
  title: string | null;
  status: string;
  max_marks?: number | string | null;
}

interface AttendanceSessionRow {
  session_id: number;
  offering_id: number;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800 ${className ?? ''}`} />;
}

function formatSubjectType(t: string | null | undefined) {
  if (!t) return '—';
  return t.replace(/_/g, ' ');
}

function countByStatus(assessments: AssessmentRow[] | undefined) {
  const map: Record<string, number> = {};
  for (const a of assessments ?? []) {
    const k = a.status || 'UNKNOWN';
    map[k] = (map[k] ?? 0) + 1;
  }
  return map;
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function FacultyDashboardPage() {
  const hasAttendance = usePermission('ATTENDANCE_MARK');
  const hasMarks = usePermission('MARKS_ENTER');
  const canAccess = hasAttendance || hasMarks;
  const [searchParams] = useSearchParams();
  const termIdParam = searchParams.get('term_id');
  const termId = termIdParam ? Number(termIdParam) : undefined;
  const termQuery = termId != null && !Number.isNaN(termId) ? termId : undefined;

  const subjectsQuery = useQuery({
    queryKey: ['faculty', 'subjects', termQuery ?? 'all'],
    queryFn: () =>
      api
        .get<FacultySubject[]>('/faculty/subjects', {
          params: termQuery != null ? { term_id: termQuery } : {},
        })
        .then((r) => r.data),
    enabled: canAccess,
  });

  const subjects = subjectsQuery.data;

  const activeOfferingIds = useMemo(
    () => (subjects ?? []).filter((s) => s.status === 'ACTIVE').map((s) => s.offering_id),
    [subjects],
  );

  const assessmentQueries = useQueries({
    queries: activeOfferingIds.map((offeringId) => ({
      queryKey: ['marks', 'offerings', offeringId, 'assessments'],
      queryFn: () =>
        api.get<AssessmentRow[]>(`/marks/offerings/${offeringId}/assessments`).then((r) => r.data),
      enabled: canAccess && activeOfferingIds.length > 0,
    })),
  });

  const sessionQueries = useQueries({
    queries: activeOfferingIds.map((offeringId) => ({
      queryKey: ['attendance', 'offerings', offeringId, 'sessions'],
      queryFn: () =>
        api.get<AttendanceSessionRow[]>(`/attendance/offerings/${offeringId}/sessions`).then((r) => r.data),
      enabled: canAccess && activeOfferingIds.length > 0,
    })),
  });

  const offeringIdToAssessments = useMemo(() => {
    const m = new Map<number, AssessmentRow[]>();
    activeOfferingIds.forEach((oid, i) => {
      m.set(oid, assessmentQueries[i]?.data ?? []);
    });
    return m;
  }, [activeOfferingIds, assessmentQueries]);

  const offeringIdToSessionCount = useMemo(() => {
    const m = new Map<number, number>();
    activeOfferingIds.forEach((oid, i) => {
      m.set(oid, sessionQueries[i]?.data?.length ?? 0);
    });
    return m;
  }, [activeOfferingIds, sessionQueries]);

  const pendingDrafts = useMemo(() => {
    const rows: { offeringId: number; subjectName: string; assessment: AssessmentRow }[] = [];
    if (!subjects) return rows;
    for (const sub of subjects) {
      if (sub.status !== 'ACTIVE') continue;
      const list = offeringIdToAssessments.get(sub.offering_id) ?? [];
      for (const a of list) {
        if (a.status === 'DRAFT') {
          rows.push({
            offeringId: sub.offering_id,
            subjectName: sub.subject_name ?? sub.subject_code ?? `Offering #${sub.offering_id}`,
            assessment: a,
          });
        }
      }
    }
    return rows;
  }, [subjects, offeringIdToAssessments]);

  const todayClasses = useMemo(
    () => (subjects ?? []).filter((s) => s.status === 'ACTIVE' || s.status === 'LOCKED'),
    [subjects],
  );

  if (!canAccess) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <p className="font-medium">You don&apos;t have access to the faculty dashboard.</p>
        <p className="mt-1 text-sm opacity-90">
          Required: at least one of ATTENDANCE_MARK or MARKS_ENTER.
        </p>
      </div>
    );
  }

  if (subjectsQuery.isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-100">
        Could not load your subjects. Please try again or contact support.
      </div>
    );
  }

  const loadingSubjects = subjectsQuery.isLoading;
  const loadingDetails =
    activeOfferingIds.length > 0 &&
    (assessmentQueries.some((q) => q.isLoading) || sessionQueries.some((q) => q.isLoading));

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Faculty dashboard</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Your subjects, attendance, and marks —{' '}
          {termQuery != null ? (
            <span>filtered to term {termQuery}</span>
          ) : (
            <span>all terms you lead</span>
          )}
          . Add <code className="rounded bg-gray-100 px-1 dark:bg-gray-800">?term_id=</code> to the URL to
          filter.
        </p>
      </header>

      {/* A) Today&apos;s classes */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <School className="h-5 w-5 text-primary" />
          Today&apos;s classes
        </h2>
        <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
          Timetable integration is not connected yet; showing active and locked offerings you lead this term.
        </p>
        {loadingSubjects ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
        ) : todayClasses.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-gray-500 dark:border-gray-700">
            No scheduled offerings (active or locked) found.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {todayClasses.map((s) => (
              <div
                key={s.offering_id}
                className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      {s.subject_name ?? s.subject_code ?? 'Subject'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Section {s.section_id ?? '—'} · {formatSubjectType(s.subject_type)}
                    </p>
                  </div>
                  {s.status === 'LOCKED' && (
                    <span title="Offering is locked">
                      <Lock className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
                    </span>
                  )}
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {s.status === 'LOCKED' ? (
                    <span className="inline-flex flex-1 cursor-not-allowed items-center justify-center rounded-lg bg-gray-400 px-3 py-2 text-sm font-medium text-white opacity-80">
                      Mark attendance
                    </span>
                  ) : (
                    <Link
                      to={`/faculty/subjects/${s.offering_id}/attendance`}
                      className="inline-flex flex-1 items-center justify-center rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:opacity-90"
                    >
                      Mark attendance
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* B) Subject summary */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <ClipboardList className="h-5 w-5 text-primary" />
          Subject summary
        </h2>
        {loadingSubjects ? (
          <Skeleton className="h-48 w-full" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
            <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Subject</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-200">
                    Enrollment
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-200">Sessions</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-700 dark:text-gray-200">
                    Assessments by status
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white dark:divide-gray-800 dark:bg-gray-900">
                {(subjects ?? []).map((s) => {
                  const assessments =
                    s.status === 'ACTIVE' ? offeringIdToAssessments.get(s.offering_id) ?? [] : [];
                  const statusCounts = countByStatus(assessments);
                  const sessionCount =
                    s.status === 'ACTIVE' ? offeringIdToSessionCount.get(s.offering_id) ?? 0 : null;

                  return (
                    <tr key={s.offering_id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {s.subject_name ?? s.subject_code ?? '—'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {s.subject_code && <span>{s.subject_code} · </span>}
                          Section {s.section_id ?? '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium dark:bg-gray-800">
                          {s.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {s.current_enrollment}
                        {s.max_enrollment != null && (
                          <span className="text-gray-400"> / {s.max_enrollment}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {loadingDetails && s.status === 'ACTIVE' ? (
                          <span className="text-gray-400">…</span>
                        ) : sessionCount != null ? (
                          sessionCount
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                        {s.status === 'ACTIVE' ? (
                          Object.keys(statusCounts).length ? (
                            <ul className="space-y-0.5">
                              {Object.entries(statusCounts).map(([st, n]) => (
                                <li key={st}>
                                  {st}: {n}
                                </li>
                              ))}
                            </ul>
                          ) : loadingDetails ? (
                            <span className="text-gray-400">…</span>
                          ) : (
                            'None'
                          )
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Link
                            to={`/faculty/subjects/${s.offering_id}/attendance`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                            Attendance
                          </Link>
                          <Link
                            to={`/faculty/subjects/${s.offering_id}/marks`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            Marks
                          </Link>
                          <Link
                            to={`/faculty/subjects/${s.offering_id}/analytics`}
                            className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
                          >
                            <BarChart3 className="h-3.5 w-3.5" />
                            Analytics
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* C) Pending actions */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-white">
          <FileText className="h-5 w-5 text-primary" />
          Pending actions
        </h2>
        {loadingSubjects || (activeOfferingIds.length > 0 && loadingDetails) ? (
          <Skeleton className="h-24 w-full" />
        ) : pendingDrafts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-gray-200 p-6 text-center text-gray-500 dark:border-gray-700">
            No assessments in DRAFT status.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white dark:divide-gray-800 dark:border-gray-700 dark:bg-gray-900">
            {pendingDrafts.map(({ offeringId, subjectName, assessment }) => (
              <li key={`${offeringId}-${assessment.assessment_id}`} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{subjectName}</p>
                  <p className="truncate text-sm text-gray-600 dark:text-gray-400">
                    {assessment.title ?? `Assessment #${assessment.assessment_id}`}
                  </p>
                </div>
                <Link
                  to={`/faculty/subjects/${offeringId}/marks#a-${assessment.assessment_id}`}
                  className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
                >
                  Enter marks
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
