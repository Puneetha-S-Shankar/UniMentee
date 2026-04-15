import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';
import CrudModal from '../components/CrudModal';
import { DataTable } from '../components/DataTable';

interface ProgramOut {
  program_id: number;
  name: string;
  code: string;
  degree_type: string;
  duration_years: number;
  total_semesters: number;
  status: string;
}

const DEGREE_TYPES = ['B.Tech', 'BCA', 'B.Sc', 'M.Tech', 'MBA', 'MCA'] as const;

const programSchema = z.object({
  name: z.string().min(1, 'Required'),
  code: z.string().min(1, 'Required'),
  degree_type: z.enum(['B.Tech', 'BCA', 'B.Sc', 'M.Tech', 'MBA', 'MCA']),
  duration_years: z.coerce.number().min(1).max(6),
  total_semesters: z.coerce.number().int().min(1).max(12),
  total_credits: z.coerce.number().optional(),
  department_id: z.string().optional(),
});

type ProgramForm = z.infer<typeof programSchema>;

export default function ProgramsPage() {
  const can = usePermission('ACADEMIC_MANAGE');
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const programsQuery = useQuery({
    queryKey: ['academic', 'programs'],
    queryFn: () => api.get<ProgramOut[]>('/academic/programs').then((r) => r.data),
    enabled: can,
  });

  const form = useForm<ProgramForm>({
    resolver: zodResolver(programSchema) as Resolver<ProgramForm>,
    defaultValues: {
      name: '',
      code: '',
      degree_type: 'B.Tech',
      duration_years: 4,
      total_semesters: 8,
      total_credits: undefined,
      department_id: undefined,
    },
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/academic/programs', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic', 'programs'] });
      setModalOpen(false);
      form.reset();
      setToast('Program created.');
      window.setTimeout(() => setToast(null), 3000);
    },
  });

  const archiveMut = useMutation({
    mutationFn: (programId: number) =>
      api.patch(`/academic/programs/${programId}`, { status: 'ARCHIVED' }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic', 'programs'] });
      setToast('Program archived.');
      window.setTimeout(() => setToast(null), 3000);
    },
  });

  if (!can) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-gray-600 dark:text-gray-400">
        ACADEMIC_MANAGE permission required.
      </div>
    );
  }

  const rows = programsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Programs</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Manage degree programs.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create program
        </button>
      </div>

      <DataTable>
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
          <tr>
            <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Code</th>
            <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Name</th>
            <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Degree</th>
            <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Duration (y)</th>
            <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Semesters</th>
            <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
            <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((p) => (
            <tr key={p.program_id}>
              <td className="px-4 py-3 font-mono text-xs">{p.code}</td>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.name}</td>
              <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{p.degree_type}</td>
              <td className="px-4 py-3">{p.duration_years}</td>
              <td className="px-4 py-3">{p.total_semesters}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{p.status}</span>
              </td>
              <td className="px-4 py-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="text-xs font-medium text-primary hover:underline"
                    onClick={() => window.alert('Edit not yet available')}
                  >
                    Edit
                  </button>
                  {p.status === 'ACTIVE' ? (
                    <button
                      type="button"
                      className="text-xs font-medium text-amber-800 hover:underline dark:text-amber-200"
                      onClick={() => {
                        if (window.confirm('Archive this program?')) archiveMut.mutate(p.program_id);
                      }}
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {programsQuery.isLoading ? <p className="text-sm text-gray-500">Loading…</p> : null}

      <CrudModal open={modalOpen} title="Create program" onClose={() => setModalOpen(false)} wide>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit((data) => {
            const payload: Record<string, unknown> = {
              name: data.name,
              code: data.code,
              degree_type: data.degree_type,
              duration_years: data.duration_years,
              total_semesters: data.total_semesters,
            };
            if (data.total_credits != null && !Number.isNaN(data.total_credits)) {
              payload.total_credits = data.total_credits;
            }
            if (data.department_id?.trim()) {
              payload.department_id = Number(data.department_id);
            }
            createMut.mutate(payload);
          })}
        >
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
            <input
              {...form.register('name')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Code</label>
            <input
              {...form.register('code')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Degree type</label>
            <select
              {...form.register('degree_type')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            >
              {DEGREE_TYPES.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Duration (years)</label>
            <input
              type="number"
              step="0.5"
              {...form.register('duration_years', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Total semesters</label>
            <input
              type="number"
              {...form.register('total_semesters', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Total credits (optional)</label>
            <input
              type="number"
              {...form.register('total_credits', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Department ID (optional)</label>
            <input
              type="number"
              {...form.register('department_id')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          {createMut.isError ? (
            <p className="sm:col-span-2 text-xs text-red-600">Could not create program (duplicate code?).</p>
          ) : null}
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMut.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {createMut.isPending ? 'Saving…' : 'Create'}
            </button>
          </div>
        </form>
      </CrudModal>
    </div>
  );
}
