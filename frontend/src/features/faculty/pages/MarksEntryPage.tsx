import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { isAxiosError } from 'axios';
import { ArrowLeft, ChevronRight, Loader2, Plus, X } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';
import MarksEntryRow from '../components/MarksEntryRow';

// ─── types ───────────────────────────────────────────────────────────────────

interface OfferingOut {
  offering_id: number;
  batch_id: number;
  section_id: number | null;
}

interface StudentRow {
  student_id: number;
  usn: string;
  full_name?: string | null;
}

interface AssessmentRow {
  assessment_id: number;
  title: string | null;
  status: string;
  max_marks: number | string;
  assessment_type_id?: number;
  version?: number;
}

interface MarkRow {
  mark_id: number;
  assessment_id: number;
  student_id: number;
  marks_obtained: number | null;
  is_absent: boolean;
  version: number;
}

interface AssessmentTypeRow {
  assessment_type_id: number;
  name: string;
  code: string;
}

type MarkCell = { marks_obtained: number | null; is_absent: boolean; version: number };

const createAssessmentSchema = z.object({
  assessment_type_id: z.coerce.number().int().positive({ message: 'Select an assessment type' }),
  title: z.string().min(1, 'Title is required'),
  max_marks: z.coerce.number().positive(),
  passing_marks: z.string().optional(),
  conducted_on: z.string().optional(),
});

type CreateAssessmentForm = z.infer<typeof createAssessmentSchema>;

const STATUS_ORDER = ['DRAFT', 'SUBMITTED', 'VERIFIED', 'PUBLISHED'] as const;

// ─── page ────────────────────────────────────────────────────────────────────

export default function MarksEntryPage() {
  const { offeringId: oidParam } = useParams<{ offeringId: string }>();
  const offeringId = oidParam ? Number(oidParam) : NaN;
  const canEnter = usePermission('MARKS_ENTER');
  const queryClient = useQueryClient();

  const [selectedAssessmentId, setSelectedAssessmentId] = useState<number | null>(null);
  const [marksMap, setMarksMap] = useState<Record<number, MarkCell>>({});
  const marksMapRef = useRef(marksMap);
  marksMapRef.current = marksMap;

  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const blurTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});

  const offeringQuery = useQuery({
    queryKey: ['academic', 'offerings', 'for-marks', offeringId],
    queryFn: async () => {
      const rows = await api.get<OfferingOut[]>('/academic/offerings').then((r) => r.data);
      const o = rows.find((row) => row.offering_id === offeringId);
      if (!o) throw new Error('Offering not found');
      return o;
    },
    enabled: canEnter && Number.isFinite(offeringId),
  });

  const offering = offeringQuery.data;

  const studentsQuery = useQuery({
    queryKey: ['students', 'batch', offering?.batch_id, offering?.section_id],
    queryFn: () => {
      const o = offering;
      if (!o) throw new Error('Offering not loaded');
      return api
        .get<StudentRow[]>('/students', {
          params: {
            batch_id: o.batch_id,
            ...(o.section_id != null ? { section_id: o.section_id } : {}),
          },
        })
        .then((r) => r.data);
    },
    enabled: !!offering && canEnter,
  });

  const students = studentsQuery.data ?? [];

  const assessmentsQuery = useQuery({
    queryKey: ['marks', 'offerings', offeringId, 'assessments'],
    queryFn: () => api.get<AssessmentRow[]>(`/marks/offerings/${offeringId}/assessments`).then((r) => r.data),
    enabled: Number.isFinite(offeringId) && canEnter,
  });

  const assessments = assessmentsQuery.data ?? [];

  const assessmentTypesQuery = useQuery({
    queryKey: ['academic', 'assessment-types'],
    queryFn: () => api.get<AssessmentTypeRow[]>('/academic/assessment-types').then((r) => r.data),
    enabled: canEnter && createOpen,
  });

  useEffect(() => {
    if (!assessments.length) {
      setSelectedAssessmentId(null);
      return;
    }
    setSelectedAssessmentId((prev) => {
      if (prev != null && assessments.some((a) => a.assessment_id === prev)) return prev;
      return assessments[0].assessment_id;
    });
  }, [assessments]);

  const marksQuery = useQuery({
    queryKey: ['marks', 'assessments', selectedAssessmentId, 'marks'],
    queryFn: () =>
      api.get<MarkRow[]>(`/marks/assessments/${selectedAssessmentId}/marks`).then((r) => r.data),
    enabled: selectedAssessmentId != null && canEnter,
  });

  const marksData = marksQuery.data;

  const selectedAssessment = useMemo(
    () => assessments.find((a) => a.assessment_id === selectedAssessmentId) ?? null,
    [assessments, selectedAssessmentId],
  );

  const maxMarksNum = useMemo(() => {
    if (!selectedAssessment) return 0;
    const m = selectedAssessment.max_marks;
    return typeof m === 'string' ? Number(m) : Number(m);
  }, [selectedAssessment]);

  useEffect(() => {
    if (!students.length || selectedAssessmentId == null || marksData === undefined) return;
    const next: Record<number, MarkCell> = {};
    for (const s of students) {
      const row = marksData.find((m) => m.student_id === s.student_id);
      if (row) {
        next[s.student_id] = {
          marks_obtained: row.marks_obtained != null ? Number(row.marks_obtained) : null,
          is_absent: row.is_absent,
          version: row.version,
        };
      } else {
        next[s.student_id] = { marks_obtained: null, is_absent: false, version: 1 };
      }
    }
    setMarksMap(next);
  }, [students, selectedAssessmentId, marksData]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }, []);

  const saveMarkMutation = useMutation({
    mutationFn: async ({
      studentId,
      cell,
    }: {
      studentId: number;
      cell: MarkCell;
    }) => {
      await api.put(`/marks/assessments/${selectedAssessmentId}/marks/${studentId}`, {
        student_id: studentId,
        marks_obtained: cell.is_absent ? null : cell.marks_obtained,
        is_absent: cell.is_absent,
        version: cell.version,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ['marks', 'assessments', selectedAssessmentId, 'marks'],
      });
    },
    onError: async (e) => {
      if (isAxiosError(e) && e.response?.status === 409) {
        showToast('Version conflict, refreshing…');
        await queryClient.invalidateQueries({
          queryKey: ['marks', 'assessments', selectedAssessmentId, 'marks'],
        });
        return;
      }
      showToast(isAxiosError(e) ? String(e.response?.data?.detail ?? e.message) : 'Save failed');
    },
  });

  const scheduleSave = useCallback(
    (studentId: number) => {
      if (!selectedAssessmentId || !selectedAssessment || selectedAssessment.status !== 'DRAFT') return;
      window.clearTimeout(blurTimers.current[studentId]);
      blurTimers.current[studentId] = window.setTimeout(() => {
        const cell = marksMapRef.current[studentId];
        if (!cell) return;
        saveMarkMutation.mutate({ studentId, cell });
      }, 500);
    },
    [selectedAssessmentId, selectedAssessment, saveMarkMutation],
  );

  const updateMarks = useCallback(
    (studentId: number, marks_obtained: number | null) => {
      setMarksMap((prev) => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          marks_obtained,
        },
      }));
    },
    [],
  );

  const createMutation = useMutation({
    mutationFn: (body: CreateAssessmentForm) => {
      const conducted =
        body.conducted_on && body.conducted_on.length > 0 ? body.conducted_on : undefined;
      const pm =
        body.passing_marks != null && body.passing_marks !== ''
          ? Number(body.passing_marks)
          : undefined;
      return api
        .post<AssessmentRow>(`/marks/offerings/${offeringId}/assessments`, {
          assessment_type_id: body.assessment_type_id,
          title: body.title,
          max_marks: body.max_marks,
          passing_marks: pm !== undefined && !Number.isNaN(pm) ? pm : undefined,
          conducted_on: conducted,
        })
        .then((r) => r.data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['marks', 'offerings', offeringId, 'assessments'] });
      setSelectedAssessmentId(data.assessment_id);
      setCreateOpen(false);
      resetCreate();
    },
  });

  const advanceMutation = useMutation({
    mutationFn: () => api.patch(`/marks/assessments/${selectedAssessmentId}/status`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['marks', 'offerings', offeringId, 'assessments'] });
      queryClient.invalidateQueries({ queryKey: ['marks', 'assessments', selectedAssessmentId, 'marks'] });
    },
  });

  const {
    register,
    handleSubmit,
    reset: resetCreate,
    formState: { errors: createErrors },
  } = useForm<CreateAssessmentForm>({
    resolver: zodResolver(createAssessmentSchema) as Resolver<CreateAssessmentForm>,
    defaultValues: {
      assessment_type_id: 0,
      title: '',
      max_marks: 20,
      passing_marks: undefined,
      conducted_on: '',
    },
  });

  if (!canEnter) {
    return <Navigate to="/faculty/dashboard" replace />;
  }

  if (!Number.isFinite(offeringId)) {
    return <p className="text-red-600">Invalid offering.</p>;
  }

  if (offeringQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
        Offering not found.{' '}
        <Link to="/faculty/dashboard" className="text-primary underline">
          Back
        </Link>
      </div>
    );
  }

  const gridLocked = selectedAssessment != null && selectedAssessment.status !== 'DRAFT';

  const statusIdx = selectedAssessment
    ? STATUS_ORDER.indexOf(selectedAssessment.status as (typeof STATUS_ORDER)[number])
    : -1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {toast && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm shadow-lg dark:border-gray-700 dark:bg-gray-900"
        >
          {toast}
        </div>
      )}

      <Link
        to="/faculty/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <header>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Marks entry</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Offering #{offeringId}
          {offering && (
            <>
              {' '}
              · Batch {offering.batch_id}
              {offering.section_id != null && ` · Section ${offering.section_id}`}
            </>
          )}
        </p>
      </header>

      {/* A) Assessment selector */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {assessmentsQuery.isLoading ? (
              <span className="text-sm text-gray-500">Loading assessments…</span>
            ) : assessments.length === 0 ? (
              <span className="text-sm text-gray-500">No assessments yet.</span>
            ) : (
              assessments.map((a) => (
                <button
                  key={a.assessment_id}
                  type="button"
                  onClick={() => setSelectedAssessmentId(a.assessment_id)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                    selectedAssessmentId === a.assessment_id
                      ? 'bg-primary text-white'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-100'
                  }`}
                >
                  {a.title ?? `Assessment #${a.assessment_id}`}
                </button>
              ))
            )}
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1 rounded-lg border border-primary px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/5"
          >
            <Plus className="h-4 w-4" />
            Create assessment
          </button>
        </div>

        {selectedAssessment && (
          <div className="mt-4">
            <p className="mb-2 text-xs font-medium uppercase text-gray-500">Status</p>
            <div className="flex flex-wrap items-center gap-1">
              {STATUS_ORDER.map((st, i) => {
                const active = statusIdx >= i;
                const current = selectedAssessment.status === st;
                return (
                  <div key={st} className="flex items-center">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        current
                          ? 'bg-primary text-white'
                          : active
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800'
                      }`}
                    >
                      {st}
                    </span>
                    {i < STATUS_ORDER.length - 1 && (
                      <ChevronRight className="mx-0.5 h-4 w-4 text-gray-400" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* B) Grid */}
      {selectedAssessment && (
        <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Marks
              <span className="ml-2 text-sm font-normal text-gray-500">
                Max: {maxMarksNum || '—'}
              </span>
            </h2>
            {saveMarkMutation.isPending && (
              <span className="flex items-center gap-1 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving…
              </span>
            )}
          </div>
          {studentsQuery.isLoading || marksQuery.isLoading ? (
            <div className="animate-pulse p-8 text-center text-gray-500">Loading…</div>
          ) : students.length === 0 ? (
            <p className="p-8 text-center text-gray-500">No students for this batch/section.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600 dark:bg-gray-800/80">
                    <th className="px-3 py-2">USN</th>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Marks (max {maxMarksNum})</th>
                    <th className="px-3 py-2 text-center">Absent</th>
                  </tr>
                </thead>
                <tbody>
                  {students
                    .slice()
                    .sort((a, b) => a.usn.localeCompare(b.usn))
                    .map((s) => {
                      const cell = marksMap[s.student_id] ?? {
                        marks_obtained: null,
                        is_absent: false,
                        version: 1,
                      };
                      return (
                        <MarksEntryRow
                          key={s.student_id}
                          usn={s.usn}
                          name={s.full_name?.trim() || '—'}
                          maxMarks={maxMarksNum || 100}
                          marksObtained={cell.marks_obtained}
                          isAbsent={cell.is_absent}
                          disabled={gridLocked}
                          onMarksChange={(v) => updateMarks(s.student_id, v)}
                          onAbsentChange={(abs) => {
                            const prev = marksMapRef.current[s.student_id] ?? {
                              marks_obtained: null,
                              is_absent: false,
                              version: 1,
                            };
                            const nextCell: MarkCell = {
                              marks_obtained: abs ? null : prev.marks_obtained,
                              is_absent: abs,
                              version: prev.version,
                            };
                            setMarksMap((p) => ({ ...p, [s.student_id]: nextCell }));
                            if (selectedAssessment?.status === 'DRAFT') {
                              saveMarkMutation.mutate({ studentId: s.student_id, cell: nextCell });
                            }
                          }}
                          onCommit={() => scheduleSave(s.student_id)}
                        />
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
          {gridLocked && (
            <p className="border-t border-gray-100 px-4 py-3 text-sm text-amber-800 dark:border-gray-800 dark:text-amber-200">
              This assessment is no longer editable ({selectedAssessment.status}).
            </p>
          )}
        </section>
      )}

      {/* C) Submit */}
      {selectedAssessment && selectedAssessment.status === 'DRAFT' && (
        <div className="flex justify-end">
          <button
            type="button"
            disabled={advanceMutation.isPending}
            onClick={() => {
              const label = selectedAssessment.title ?? 'this assessment';
              if (
                !window.confirm(
                  `Submit marks for ${label} for verification? You can no longer edit after submission.`,
                )
              )
                return;
              advanceMutation.mutate();
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {advanceMutation.isPending ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />
                Submitting…
              </>
            ) : (
              'Submit for verification'
            )}
          </button>
        </div>
      )}

      {/* Modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">New assessment</h3>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form
              onSubmit={handleSubmit((data: CreateAssessmentForm) => {
                createMutation.mutate(data);
              })}
              className="space-y-3"
            >
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">Assessment type</span>
                <select
                  {...register('assessment_type_id', { valueAsNumber: true })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                >
                  <option value="">Select…</option>
                  {(assessmentTypesQuery.data ?? []).map((t) => (
                    <option key={t.assessment_type_id} value={t.assessment_type_id}>
                      {t.code} — {t.name}
                    </option>
                  ))}
                </select>
                {createErrors.assessment_type_id && (
                  <span className="text-xs text-red-600">{createErrors.assessment_type_id.message}</span>
                )}
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">Title</span>
                <input
                  {...register('title')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                  placeholder="e.g. IA-1"
                />
                {createErrors.title && (
                  <span className="text-xs text-red-600">{createErrors.title.message}</span>
                )}
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">Max marks</span>
                <input
                  type="number"
                  step={0.5}
                  {...register('max_marks', { valueAsNumber: true })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">Passing marks (optional)</span>
                <input
                  type="number"
                  step={0.5}
                  {...register('passing_marks')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600 dark:text-gray-400">Conducted on</span>
                <input
                  type="date"
                  {...register('conducted_on')}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                />
              </label>
              {createMutation.isError && (
                <p className="text-sm text-red-600">Could not create assessment.</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating…' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
