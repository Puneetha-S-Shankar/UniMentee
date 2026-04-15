import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Plus } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';

interface StudentListRow {
  student_id: number;
  usn: string;
  full_name: string | null;
  batch_id: number;
}

// ─── API types ───────────────────────────────────────────────────────────────

interface MentorBrief {
  user_id: number;
  full_name: string;
}

interface StudentBrief {
  student_id: number;
  full_name: string;
  usn: string;
  batch_id: number;
}

export interface MentorAssignmentDetail {
  assignment_id: number;
  mentor: MentorBrief;
  student: StudentBrief;
  academic_year_id: number;
  status: string;
  assigned_at: string | null;
}

interface MentorLoadRow {
  mentor_user_id: number;
  full_name: string;
  active_mentees: number;
  at_risk_mentees: number;
  sessions_this_month: number;
}

interface AdminUserOut {
  user_id: number;
  full_name: string;
  email: string;
  status: string;
  roles: { role_id: number; name: string; display_name: string | null }[];
}

interface BatchOut {
  batch_id: number;
  program_id: number;
  batch_year: number;
  status: string;
}

const createSchema = z.object({
  mentor_user_id: z.coerce.number().int().positive({ message: 'Select a mentor' }),
  academic_year_id: z.coerce.number().int().positive({ message: 'Academic year required' }),
  batch_id: z.coerce.number().int().positive({ message: 'Select a batch to pick students' }),
  student_ids: z.array(z.number()).min(1, 'Select at least one student'),
});

type CreateForm = z.infer<typeof createSchema>;

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative z-10 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export default function MentorAssignmentsPage() {
  const canManage = usePermission('USER_MANAGE');
  const queryClient = useQueryClient();

  const [mentorFilter, setMentorFilter] = useState<number | ''>('');
  const [batchFilter, setBatchFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [mentorSearch, setMentorSearch] = useState('');

  const loadQuery = useQuery({
    queryKey: ['admin', 'mentor-assignments', 'mentor-load'],
    queryFn: () => api.get<MentorLoadRow[]>('/admin/mentor-assignments/mentor-load').then((r) => r.data),
    enabled: canManage,
  });

  const assignmentsQuery = useQuery({
    queryKey: ['admin', 'mentor-assignments', 'list', mentorFilter, batchFilter, statusFilter],
    queryFn: () =>
      api
        .get<MentorAssignmentDetail[]>('/admin/mentor-assignments', {
          params: {
            ...(mentorFilter !== '' ? { mentor_id: mentorFilter } : {}),
            ...(batchFilter !== '' ? { batch_id: batchFilter } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
          },
        })
        .then((r) => r.data),
    enabled: canManage,
  });

  const mentorsForSelect = useQuery({
    queryKey: ['admin', 'users', 'MENTOR'],
    queryFn: () =>
      api.get<AdminUserOut[]>('/admin/users', { params: { role: 'MENTOR' } }).then((r) => r.data),
    enabled: canManage,
  });

  const batchesQuery = useQuery({
    queryKey: ['academic', 'batches', 'all'],
    queryFn: () => api.get<BatchOut[]>('/academic/batches', { params: {} }).then((r) => r.data),
    enabled: canManage,
  });

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema) as Resolver<CreateForm>,
    defaultValues: {
      mentor_user_id: undefined as unknown as number,
      academic_year_id: new Date().getFullYear(),
      batch_id: undefined as unknown as number,
      student_ids: [],
    },
  });

  const wfBatch = form.watch('batch_id');
  const wfMentor = form.watch('mentor_user_id');

  const studentsInBatch = useQuery({
    queryKey: ['students', 'for-mentor-assign', wfBatch],
    queryFn: () =>
      api
        .get<StudentListRow[]>('/students', { params: { batch_id: wfBatch, status: 'ACTIVE' } })
        .then((r) => r.data),
    enabled: createOpen && !!wfBatch && wfBatch > 0,
  });

  const createMutation = useMutation({
    mutationFn: (body: { mentor_user_id: number; student_ids: number[]; academic_year_id: number }) =>
      api.post<MentorAssignmentDetail[]>('/admin/mentor-assignments', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'mentor-assignments'] });
      setCreateOpen(false);
      form.reset({
        mentor_user_id: undefined as unknown as number,
        academic_year_id: new Date().getFullYear(),
        batch_id: undefined as unknown as number,
        student_ids: [],
      });
    },
  });

  const relieveMutation = useMutation({
    mutationFn: (assignmentId: number) =>
      api.patch<MentorAssignmentDetail>(`/admin/mentor-assignments/${assignmentId}/status`, {
        status: 'RELIEVED',
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['admin', 'mentor-assignments'] }),
  });

  const filteredMentors = useMemo(() => {
    const list = mentorsForSelect.data ?? [];
    const q = mentorSearch.trim().toLowerCase();
    if (!q) return list;
    return list.filter((m) => m.full_name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q));
  }, [mentorsForSelect.data, mentorSearch]);

  const toggleStudent = (id: number) => {
    const cur = form.getValues('student_ids');
    if (cur.includes(id)) {
      form.setValue(
        'student_ids',
        cur.filter((x) => x !== id),
        { shouldValidate: true },
      );
    } else {
      form.setValue('student_ids', [...cur, id], { shouldValidate: true });
    }
  };

  const rows = assignmentsQuery.data ?? [];
  const loadRows = loadQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const batchYearById = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of batches) m.set(b.batch_id, b.batch_year);
    return m;
  }, [batches]);

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Access denied</p>
        <p className="mt-2 text-sm text-gray-500">USER_MANAGE permission required.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mentor assignments</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Assign mentors to students and monitor load.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create assignment
        </button>
      </div>

      {/* A) Mentor load overview */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Mentor load overview
        </h2>
        {loadQuery.isLoading ? (
          <div className="text-sm text-gray-500">Loading overview…</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
                <tr>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Mentor</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Active mentees</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">At-risk mentees</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Sessions (this month)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {loadRows.map((m) => (
                  <tr key={m.mentor_user_id}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {m.at_risk_mentees > 3 ? (
                          <span title="More than 3 at-risk mentees">
                            <AlertTriangle className="h-4 w-4 shrink-0 text-red-600" aria-hidden />
                          </span>
                        ) : null}
                        <span className="font-medium text-gray-900 dark:text-white">{m.full_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.active_mentees}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.at_risk_mentees}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{m.sessions_this_month}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {loadRows.length === 0 ? (
              <div className="p-6 text-center text-sm text-gray-500">No mentors found.</div>
            ) : null}
          </div>
        )}
      </section>

      {/* B) Filters */}
      <div className="flex flex-wrap gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <div>
          <label className="text-xs font-medium text-gray-500">Mentor</label>
          <select
            value={mentorFilter === '' ? '' : String(mentorFilter)}
            onChange={(e) => setMentorFilter(e.target.value ? Number(e.target.value) : '')}
            className="mt-1 w-full min-w-[180px] rounded-lg border border-gray-300 py-2 px-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All mentors</option>
            {(mentorsForSelect.data ?? []).map((u) => (
              <option key={u.user_id} value={u.user_id}>
                {u.full_name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Batch</label>
          <select
            value={batchFilter === '' ? '' : String(batchFilter)}
            onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : '')}
            className="mt-1 w-full min-w-[160px] rounded-lg border border-gray-300 py-2 px-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.batch_id} value={b.batch_id}>
                Batch {b.batch_year}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 w-full min-w-[140px] rounded-lg border border-gray-300 py-2 px-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="RELIEVED">Relieved</option>
          </select>
        </div>
      </div>

      {/* C) Assignments table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Assignments
        </h2>
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          {assignmentsQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">Loading…</div>
          ) : assignmentsQuery.isError ? (
            <div className="p-8 text-center text-sm text-red-600">Failed to load assignments.</div>
          ) : (
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
                <tr>
                  <th className="px-4 py-3 font-semibold">Mentor</th>
                  <th className="px-4 py-3 font-semibold">Student</th>
                  <th className="px-4 py-3 font-semibold">Batch</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Assigned</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((a) => (
                  <tr key={a.assignment_id}>
                    <td className="px-4 py-3 text-gray-900 dark:text-white">{a.mentor.full_name}</td>
                    <td className="px-4 py-3">
                      <div className="font-mono text-xs text-gray-600 dark:text-gray-400">{a.student.usn}</div>
                      <div className="text-gray-900 dark:text-white">{a.student.full_name}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">
                      Batch {batchYearById.get(a.student.batch_id) ?? a.student.batch_id}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          a.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                            : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-100'
                        }`}
                      >
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                      {a.assigned_at ? new Date(a.assigned_at).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-4 py-3">
                      {a.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm('Relieve this mentor from this student?')) {
                              relieveMutation.mutate(a.assignment_id);
                            }
                          }}
                          disabled={relieveMutation.isPending}
                          className="text-xs font-medium text-amber-800 hover:underline dark:text-amber-200"
                        >
                          Relieve
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!assignmentsQuery.isLoading && rows.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-500">No assignments match filters.</div>
          ) : null}
        </div>
      </section>

      {createOpen ? (
        <Modal title="Create mentor assignments" onClose={() => setCreateOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit((data) =>
              createMutation.mutate({
                mentor_user_id: data.mentor_user_id,
                student_ids: data.student_ids,
                academic_year_id: data.academic_year_id,
              }),
            )}
          >
            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Mentor</label>
              <input
                type="search"
                value={mentorSearch}
                onChange={(e) => setMentorSearch(e.target.value)}
                placeholder="Search mentors…"
                className="mb-2 mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
              <select
                {...form.register('mentor_user_id', { valueAsNumber: true })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              >
                <option value={0}>Select mentor</option>
                {filteredMentors.map((m) => (
                  <option key={m.user_id} value={m.user_id}>
                    {m.full_name} ({m.email})
                  </option>
                ))}
              </select>
              {form.formState.errors.mentor_user_id ? (
                <p className="mt-1 text-xs text-red-600">{form.formState.errors.mentor_user_id.message}</p>
              ) : null}
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Academic year ID</label>
              <input
                type="number"
                {...form.register('academic_year_id', { valueAsNumber: true })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Batch (for student list)</label>
              <select
                {...form.register('batch_id', { valueAsNumber: true })}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
              >
                <option value={0}>Select batch</option>
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    Batch {b.batch_year}
                  </option>
                ))}
              </select>
            </div>

            {wfBatch ? (
              <div>
                <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Students</span>
                <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                  {(studentsInBatch.data ?? []).map((s) => (
                    <label key={s.student_id} className="flex cursor-pointer items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={form.watch('student_ids').includes(s.student_id)}
                        onChange={() => toggleStudent(s.student_id)}
                        className="rounded border-gray-300"
                      />
                      <span className="font-mono text-xs text-gray-500">{s.usn}</span>
                      <span>{s.full_name ?? '—'}</span>
                    </label>
                  ))}
                </div>
                {studentsInBatch.isLoading ? (
                  <p className="mt-1 text-xs text-gray-500">Loading students…</p>
                ) : null}
                {form.formState.errors.student_ids ? (
                  <p className="mt-1 text-xs text-red-600">{form.formState.errors.student_ids.message}</p>
                ) : null}
              </div>
            ) : null}

            {createMutation.isError ? (
              <p className="text-xs text-red-600">
                {(createMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ??
                  'Could not create assignments.'}
              </p>
            ) : null}

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
                disabled={createMutation.isPending || !wfMentor}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {createMutation.isPending ? 'Saving…' : 'Submit'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
    </div>
  );
}
