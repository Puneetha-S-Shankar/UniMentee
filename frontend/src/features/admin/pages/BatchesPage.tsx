import { useMemo, useState } from 'react';
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
}

interface BatchOut {
  batch_id: number;
  program_id: number;
  batch_year: number;
  start_year: number;
  end_year: number;
  status: string;
}

const batchSchema = z
  .object({
    program_id: z.coerce.number().int().positive(),
    batch_year: z.coerce.number().int(),
    start_year: z.coerce.number().int(),
    end_year: z.coerce.number().int(),
  })
  .refine((d) => d.end_year > d.start_year, { message: 'End year must be after start year', path: ['end_year'] });

type BatchForm = z.infer<typeof batchSchema>;

export default function BatchesPage() {
  const can = usePermission('ACADEMIC_MANAGE');
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [programFilter, setProgramFilter] = useState<number | ''>('');
  const [toast, setToast] = useState<string | null>(null);

  const programsQuery = useQuery({
    queryKey: ['academic', 'programs'],
    queryFn: () => api.get<ProgramOut[]>('/academic/programs').then((r) => r.data),
    enabled: can,
  });

  const batchesQuery = useQuery({
    queryKey: ['academic', 'batches', programFilter],
    queryFn: () =>
      api
        .get<BatchOut[]>('/academic/batches', {
          params: programFilter !== '' ? { program_id: programFilter } : {},
        })
        .then((r) => r.data),
    enabled: can,
  });

  const programs = programsQuery.data ?? [];
  const programName = useMemo(() => {
    const m = new Map<number, string>();
    for (const p of programs) m.set(p.program_id, p.name);
    return m;
  }, [programs]);

  const form = useForm<BatchForm>({
    resolver: zodResolver(batchSchema) as Resolver<BatchForm>,
    defaultValues: {
      program_id: 0,
      batch_year: new Date().getFullYear(),
      start_year: new Date().getFullYear(),
      end_year: new Date().getFullYear() + 4,
    },
  });

  const createMut = useMutation({
    mutationFn: (body: BatchForm) => api.post('/academic/batches', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic', 'batches'] });
      setModalOpen(false);
      form.reset({
        program_id: 0,
        batch_year: new Date().getFullYear(),
        start_year: new Date().getFullYear(),
        end_year: new Date().getFullYear() + 4,
      });
      setToast('Batch created.');
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

  const rows = batchesQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Batches</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Cohorts per program.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create batch
        </button>
      </div>

      <div className="max-w-xs">
        <label className="text-xs font-medium text-gray-500">Filter by program</label>
        <select
          value={programFilter === '' ? '' : String(programFilter)}
          onChange={(e) => setProgramFilter(e.target.value ? Number(e.target.value) : '')}
          className="mt-1 w-full rounded-lg border border-gray-300 py-2 px-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
        >
          <option value="">All programs</option>
          {programs.map((p) => (
            <option key={p.program_id} value={p.program_id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <DataTable>
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
          <tr>
            <th className="px-4 py-3 font-semibold">Batch year</th>
            <th className="px-4 py-3 font-semibold">Program</th>
            <th className="px-4 py-3 font-semibold">Start year</th>
            <th className="px-4 py-3 font-semibold">End year</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {rows.map((b) => (
            <tr key={b.batch_id}>
              <td className="px-4 py-3 font-medium">{b.batch_year}</td>
              <td className="px-4 py-3 text-gray-900 dark:text-white">
                {programName.get(b.program_id) ?? `#${b.program_id}`}
              </td>
              <td className="px-4 py-3">{b.start_year}</td>
              <td className="px-4 py-3">{b.end_year}</td>
              <td className="px-4 py-3">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{b.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {batchesQuery.isLoading ? <p className="text-sm text-gray-500">Loading…</p> : null}

      <CrudModal open={modalOpen} title="Create batch" onClose={() => setModalOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((data: BatchForm) => createMut.mutate(data))}
        >
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Program</label>
            <select
              {...form.register('program_id', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            >
              <option value={0}>Select program</option>
              {programs.map((p) => (
                <option key={p.program_id} value={p.program_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Batch year</label>
            <input
              type="number"
              {...form.register('batch_year', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Start year</label>
            <input
              type="number"
              {...form.register('start_year', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">End year</label>
            <input
              type="number"
              {...form.register('end_year', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          {createMut.isError ? (
            <p className="text-xs text-red-600">Create failed (duplicate batch for program?).</p>
          ) : null}
          <div className="flex justify-end gap-2 pt-2">
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
