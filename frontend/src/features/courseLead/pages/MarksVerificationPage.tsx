import { useMemo, useState } from 'react';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import api from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';

interface FacultySubjectOut {
  offering_id: number;
  batch_id: number;
  section_id: number | null;
  term_id: number;
  status: string;
  current_enrollment: number;
  max_enrollment: number | null;
  subject_code: string | null;
  subject_name: string | null;
}

interface AssessmentOut {
  assessment_id: number;
  offering_id: number;
  title: string | null;
  max_marks: number;
  status: string;
  submitted_by: number | null;
  version: number;
}

interface MarkRow {
  mark_id: number;
  student_id: number;
  marks_obtained: number | null;
  is_absent: boolean;
  usn: string | null;
  full_name: string | null;
}

interface BatchOut {
  batch_id: number;
  batch_year: number;
}

function pct(marks: number | null | undefined, maxMarks: number, absent: boolean): string {
  if (absent || marks == null || maxMarks <= 0) return '—';
  return `${((marks / maxMarks) * 100).toFixed(1)}%`;
}

function statsFromMarks(rows: MarkRow[]) {
  const nums = rows
    .filter((r) => !r.is_absent && r.marks_obtained != null)
    .map((r) => r.marks_obtained as number);
  if (!nums.length) {
    return { avg: null as number | null, hi: null as number | null, lo: null as number | null };
  }
  const sum = nums.reduce((a, b) => a + b, 0);
  return {
    avg: Math.round((sum / nums.length) * 100) / 100,
    hi: Math.max(...nums),
    lo: Math.min(...nums),
  };
}

export default function MarksVerificationPage() {
  const user = useAuthStore((s) => s.user);
  const roles = user?.roles ?? [];
  const permissions = user?.permissions ?? [];
  const canAccess = permissions.includes('MARKS_VERIFY') || roles.includes('COURSE_LEAD');

  const queryClient = useQueryClient();
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [sendBackOpen, setSendBackOpen] = useState(false);
  const [sendBackReason, setSendBackReason] = useState('');

  const subjectsQuery = useQuery({
    queryKey: ['faculty', 'subjects', 'verification'],
    queryFn: () => api.get<FacultySubjectOut[]>('/faculty/subjects').then((r) => r.data),
    enabled: canAccess,
  });

  const batchesQuery = useQuery({
    queryKey: ['academic', 'batches', 'verification'],
    queryFn: () => api.get<BatchOut[]>('/academic/batches').then((r) => r.data),
    enabled: canAccess,
  });

  const offerings = subjectsQuery.data ?? [];
  const assessQueries = useQueries({
    queries: offerings.map((o) => ({
      queryKey: ['marks', 'assessments', o.offering_id],
      queryFn: () =>
        api.get<AssessmentOut[]>(`/marks/offerings/${o.offering_id}/assessments`).then((r) => r.data),
      enabled: canAccess && !!subjectsQuery.data,
    })),
  });

  const batchYear = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of batchesQuery.data ?? []) {
      m.set(b.batch_id, b.batch_year);
    }
    return m;
  }, [batchesQuery.data]);

  const pending = useMemo(() => {
    const rows: {
      assessment: AssessmentOut;
      offering: FacultySubjectOut;
    }[] = [];
    offerings.forEach((off, i) => {
      const data = assessQueries[i]?.data;
      if (!data) return;
      for (const a of data) {
        if (a.status === 'SUBMITTED') {
          rows.push({ assessment: a, offering: off });
        }
      }
    });
    return rows;
  }, [offerings, assessQueries]);

  const reviewAssessment = pending.find((p) => p.assessment.assessment_id === reviewId)?.assessment ?? null;
  const reviewOffering = pending.find((p) => p.assessment.assessment_id === reviewId)?.offering ?? null;

  const marksQuery = useQuery({
    queryKey: ['marks', 'assessment', reviewId, 'detail'],
    queryFn: () =>
      api
        .get<MarkRow[]>(`/marks/assessments/${reviewId}/marks`, {
          params: { include_students: true },
        })
        .then((r) => r.data),
    enabled: canAccess && reviewId != null,
  });

  const verifyMutation = useMutation({
    mutationFn: (assessmentId: number) =>
      api.patch(`/marks/assessments/${assessmentId}/status`, { action: 'verify' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marks'] });
      queryClient.invalidateQueries({ queryKey: ['faculty', 'subjects'] });
      setReviewId(null);
      setSendBackOpen(false);
      setSendBackReason('');
    },
  });

  const sendBackMutation = useMutation({
    mutationFn: ({ assessmentId, reason }: { assessmentId: number; reason: string }) =>
      api.patch(`/marks/assessments/${assessmentId}/status`, {
        action: 'send_back',
        reason,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marks'] });
      queryClient.invalidateQueries({ queryKey: ['faculty', 'subjects'] });
      setReviewId(null);
      setSendBackOpen(false);
      setSendBackReason('');
    },
  });

  if (!canAccess) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Access denied</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You need the MARKS_VERIFY permission or the COURSE_LEAD role to verify marks for your offerings.
        </p>
      </div>
    );
  }

  const maxMarks = reviewAssessment?.max_marks ?? 0;
  const marksRows = marksQuery.data ?? [];
  const st = statsFromMarks(marksRows);

  return (
    <div className="relative mx-auto max-w-5xl px-4 py-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marks verification</h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Review assessments submitted for your course-lead offerings and verify or send them back for edits.
        </p>
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Pending verifications
        </h2>
        {subjectsQuery.isLoading || assessQueries.some((q) => q.isLoading) ? (
          <p className="mt-4 text-sm text-gray-500">Loading…</p>
        ) : pending.length === 0 ? (
          <p className="mt-4 rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-600 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-300">
            No assessments in SUBMITTED status for your offerings.
          </p>
        ) : (
          <ul className="mt-4 space-y-4">
            {pending.map(({ assessment: a, offering: o }) => {
              const by = batchYear.get(o.batch_id);
              return (
                <li
                  key={a.assessment_id}
                  className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between dark:border-gray-800 dark:bg-gray-900"
                >
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {o.subject_name ?? 'Subject'}{' '}
                      {o.subject_code ? (
                        <span className="text-gray-500 dark:text-gray-400">({o.subject_code})</span>
                      ) : null}
                    </p>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                      {a.title ?? 'Assessment'} · Batch {by ?? o.batch_id} · Section {o.section_id ?? '—'}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      Submitted by user #{a.submitted_by ?? '—'} · Submitted at: not tracked in API
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setReviewId(a.assessment_id);
                      setSendBackOpen(false);
                      setSendBackReason('');
                    }}
                    className="inline-flex shrink-0 items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
                  >
                    Review
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {reviewId != null && reviewAssessment && reviewOffering ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/40"
            aria-label="Close panel"
            onClick={() => setReviewId(null)}
          />
          <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-xl flex-col border-l border-gray-200 bg-white shadow-2xl dark:border-gray-800 dark:bg-gray-950">
            <div className="flex items-start justify-between border-b border-gray-200 px-5 py-4 dark:border-gray-800">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Review marks</h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  {reviewOffering.subject_name} — {reviewAssessment.title}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewId(null)}
                className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {marksQuery.isLoading ? (
                <p className="text-sm text-gray-500">Loading marks…</p>
              ) : marksQuery.isError ? (
                <p className="text-sm text-red-600">Could not load marks.</p>
              ) : (
                <>
                  <div className="grid grid-cols-3 gap-3 rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-900">
                    <div>
                      <p className="text-xs text-gray-500">Class avg</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {st.avg != null ? st.avg : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Highest</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {st.hi != null ? st.hi : '—'}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Lowest</p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {st.lo != null ? st.lo : '—'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-800">
                      <thead className="bg-gray-50 dark:bg-gray-800/80">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">USN</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600 dark:text-gray-300">Name</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Marks</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">Max</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-600 dark:text-gray-300">%</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                        {marksRows.map((row) => (
                          <tr key={row.mark_id}>
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.usn ?? '—'}</td>
                            <td className="px-3 py-2 text-gray-900 dark:text-gray-100">{row.full_name ?? '—'}</td>
                            <td className="px-3 py-2 text-right text-gray-700 dark:text-gray-200">
                              {row.is_absent ? 'Absent' : row.marks_obtained ?? '—'}
                            </td>
                            <td className="px-3 py-2 text-right text-gray-600">{maxMarks}</td>
                            <td className="px-3 py-2 text-right text-gray-600">
                              {pct(row.marks_obtained, maxMarks, row.is_absent)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {sendBackOpen ? (
                    <div className="mt-6">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Reason for sending back
                      </label>
                      <textarea
                        value={sendBackReason}
                        onChange={(e) => setSendBackReason(e.target.value)}
                        rows={3}
                        className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
                        placeholder="Explain what needs to be corrected…"
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="border-t border-gray-200 px-5 py-4 dark:border-gray-800">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={verifyMutation.isPending || sendBackMutation.isPending}
                  onClick={() => verifyMutation.mutate(reviewId)}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  Verify
                </button>
                {!sendBackOpen ? (
                  <button
                    type="button"
                    onClick={() => setSendBackOpen(true)}
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
                  >
                    Send back
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={
                      sendBackMutation.isPending || !sendBackReason.trim() || verifyMutation.isPending
                    }
                    onClick={() =>
                      sendBackMutation.mutate({
                        assessmentId: reviewId,
                        reason: sendBackReason.trim(),
                      })
                    }
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    Confirm send back
                  </button>
                )}
              </div>
              {(verifyMutation.isError || sendBackMutation.isError) && (
                <p className="mt-2 text-xs text-red-600">Action failed. Check permissions or try again.</p>
              )}
            </div>
          </aside>
        </>
      ) : null}
    </div>
  );
}
