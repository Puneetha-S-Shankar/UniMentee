import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';
import CrudModal from '../components/CrudModal';
import { DataTable } from '../components/DataTable';

interface BatchOut {
  batch_id: number;
  program_id: number;
  batch_year: number;
}

interface SectionOut {
  section_id: number;
  batch_id: number;
  name: string;
  capacity: number | null;
  current_strength: number | null;
  status: string;
}

const sectionSchema = z.object({
  batch_id: z.coerce.number().int().positive(),
  name: z.string().min(1).max(10),
  capacity: z.coerce.number().int().min(1).default(60),
});

type SectionForm = z.infer<typeof sectionSchema>;

export default function SectionsPage() {
  const can = usePermission('ACADEMIC_MANAGE');
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [batchFilter, setBatchFilter] = useState<number | ''>('');
  const [toast, setToast] = useState<string | null>(null);

  const batchesQuery = useQuery({
    queryKey: ['academic', 'batches', 'sections-page'],
    queryFn: () => api.get<BatchOut[]>('/academic/batches', { params: {} }).then((r) => r.data),
    enabled: can,
  });

  const sectionsQuery = useQuery({
    queryKey: ['academic', 'sections', 'admin', batchFilter],
    queryFn: () =>
      api
        .get<SectionOut[]>('/academic/sections', {
          params: { batch_id: batchFilter, include_inactive: true },
        })
        .then((r) => r.data),
    enabled: can && batchFilter !== '',
  });

  const batches = batchesQuery.data ?? [];
  const batchYearById = useMemo(() => {
    const m = new Map<number, number>();
    for (const b of batches) m.set(b.batch_id, b.batch_year);
    return m;
  }, [batches]);

  const form = useForm<SectionForm>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      batch_id: 0,
      name: '',
      capacity: 60,
    },
  });

  const createMut = useMutation({
    mutationFn: (body: { batch_id: number; name: string; capacity: number }) =>
      api.post('/academic/sections', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic', 'sections'] });
      setModalOpen(false);
      form.reset({ batch_id: 0, name: '', capacity: 60 });
      setToast('Section created.');
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

  const sectionRows = sectionsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Sections</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Class sections within a batch.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create section
        </button>
      </div>

      <div className="max-w-xs">
        <label className="text-xs font-medium text-gray-500">Filter by batch</label>
        <select
          value={batchFilter === '' ? '' : String(batchFilter)}
          onChange={(e) => setBatchFilter(e.target.value ? Number(e.target.value) : '')}
          className="mt-1 w-full rounded-lg border border-gray-300 py-2 px-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
        >
          <option value="">Select batch</option>
          {batches.map((b) => (
            <option key={b.batch_id} value={b.batch_id}>
              Batch {b.batch_year}
            </option>
          ))}
        </select>
      </div>

      {batchFilter === '' ? (
        <p className="text-sm text-gray-500">Choose a batch to list sections.</p>
      ) : (
        <DataTable>
          <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
            <tr>
              <th className="px-4 py-3 font-semibold">Section</th>
              <th className="px-4 py-3 font-semibold">Batch</th>
              <th className="px-4 py-3 font-semibold">Enrolled / Capacity</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {sectionRows.map((s) => (
              <tr key={s.section_id}>
                <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.name}</td>
                <td className="px-4 py-3">Batch {batchYearById.get(s.batch_id) ?? s.batch_id}</td>
                <td className="px-4 py-3">
                  {s.current_strength ?? 0} / {s.capacity ?? '—'}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{s.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </DataTable>
      )}
      {batchFilter !== '' && sectionsQuery.isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : null}

      <CrudModal open={modalOpen} title="Create section" onClose={() => setModalOpen(false)}>
        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((data) =>
            createMut.mutate({
              batch_id: data.batch_id,
              name: data.name.trim(),
              capacity: data.capacity,
            }),
          )}
        >
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Batch</label>
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
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Name (e.g. A, B)</label>
            <input
              {...form.register('name')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Capacity</label>
            <input
              type="number"
              {...form.register('capacity', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          {createMut.isError ? (
            <p className="text-xs text-red-600">Create failed (duplicate name for batch?).</p>
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
