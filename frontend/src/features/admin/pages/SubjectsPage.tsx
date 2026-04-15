import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Search } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';
import CrudModal from '../components/CrudModal';
import { DataTable } from '../components/DataTable';

interface SubjectOut {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  credits: number;
  subject_type: string;
  theory_hours?: number | null;
  lab_hours?: number | null;
  is_active: boolean;
}

const subjectSchema = z.object({
  subject_code: z.string().min(1),
  subject_name: z.string().min(1),
  credits: z.coerce.number().positive(),
  subject_type: z.enum(['THEORY', 'LAB', 'THEORY_LAB']),
  theory_hours: z.coerce.number().optional(),
  lab_hours: z.coerce.number().optional(),
  department_id: z.string().optional(),
});

type SubjectForm = z.infer<typeof subjectSchema>;

export default function SubjectsPage() {
  const can = usePermission('ACADEMIC_MANAGE');
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [toast, setToast] = useState<string | null>(null);

  const subjectsQuery = useQuery({
    queryKey: ['academic', 'subjects', 'admin'],
    queryFn: () =>
      api.get<SubjectOut[]>('/academic/subjects', { params: { include_inactive: true } }).then((r) => r.data),
    enabled: can,
  });

  const form = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    defaultValues: {
      subject_code: '',
      subject_name: '',
      credits: 4,
      subject_type: 'THEORY',
      theory_hours: undefined,
      lab_hours: undefined,
      department_id: undefined,
    },
  });

  const createMut = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post('/academic/subjects', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['academic', 'subjects'] });
      setModalOpen(false);
      form.reset({
        subject_code: '',
        subject_name: '',
        credits: 4,
        subject_type: 'THEORY',
        theory_hours: undefined,
        lab_hours: undefined,
        department_id: undefined,
      });
      setToast('Subject created.');
      window.setTimeout(() => setToast(null), 3000);
    },
  });

  const filtered = useMemo(() => {
    let list = subjectsQuery.data ?? [];
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.subject_code.toLowerCase().includes(q) || s.subject_name.toLowerCase().includes(q),
      );
    }
    if (typeFilter) {
      list = list.filter((s) => s.subject_type === typeFilter);
    }
    return list;
  }, [subjectsQuery.data, search, typeFilter]);

  if (!can) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-gray-600 dark:text-gray-400">
        ACADEMIC_MANAGE permission required.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
      {toast ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {toast}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subjects</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Catalog of subjects.</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create subject
        </button>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <label className="text-xs font-medium text-gray-500">Search</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Code or name"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
        </div>
        <div className="w-full sm:w-48">
          <label className="text-xs font-medium text-gray-500">Type</label>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 py-2 px-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            <option value="">All</option>
            <option value="THEORY">THEORY</option>
            <option value="LAB">LAB</option>
            <option value="THEORY_LAB">THEORY_LAB</option>
          </select>
        </div>
      </div>

      <DataTable>
        <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
          <tr>
            <th className="px-4 py-3 font-semibold">Code</th>
            <th className="px-4 py-3 font-semibold">Name</th>
            <th className="px-4 py-3 font-semibold">Credits</th>
            <th className="px-4 py-3 font-semibold">Type</th>
            <th className="px-4 py-3 font-semibold">Theory hrs</th>
            <th className="px-4 py-3 font-semibold">Lab hrs</th>
            <th className="px-4 py-3 font-semibold">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {filtered.map((s) => (
            <tr key={s.subject_id}>
              <td className="px-4 py-3 font-mono text-xs">{s.subject_code}</td>
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.subject_name}</td>
              <td className="px-4 py-3">{s.credits}</td>
              <td className="px-4 py-3">{s.subject_type}</td>
              <td className="px-4 py-3">{s.theory_hours ?? '—'}</td>
              <td className="px-4 py-3">{s.lab_hours ?? '—'}</td>
              <td className="px-4 py-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs ${
                    s.is_active
                      ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100'
                      : 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200'
                  }`}
                >
                  {s.is_active ? 'Active' : 'Inactive'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </DataTable>
      {subjectsQuery.isLoading ? <p className="text-sm text-gray-500">Loading…</p> : null}

      <CrudModal open={modalOpen} title="Create subject" onClose={() => setModalOpen(false)} wide>
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={form.handleSubmit((data) => {
            const payload: Record<string, unknown> = {
              subject_code: data.subject_code,
              subject_name: data.subject_name,
              credits: data.credits,
              subject_type: data.subject_type,
            };
            if (data.theory_hours != null && !Number.isNaN(data.theory_hours)) {
              payload.theory_hours = data.theory_hours;
            }
            if (data.lab_hours != null && !Number.isNaN(data.lab_hours)) {
              payload.lab_hours = data.lab_hours;
            }
            if (data.department_id?.trim()) {
              payload.department_id = Number(data.department_id);
            }
            createMut.mutate(payload);
          })}
        >
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Code</label>
            <input
              {...form.register('subject_code')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Name</label>
            <input
              {...form.register('subject_name')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Credits</label>
            <input
              type="number"
              step="0.5"
              {...form.register('credits', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Type</label>
            <select
              {...form.register('subject_type')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            >
              {(['THEORY', 'LAB', 'THEORY_LAB'] as const).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Theory hours</label>
            <input
              type="number"
              step="0.5"
              {...form.register('theory_hours', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Lab hours</label>
            <input
              type="number"
              step="0.5"
              {...form.register('lab_hours', { valueAsNumber: true })}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="text-xs font-medium text-gray-600 dark:text-gray-400">Department ID (optional)</label>
            <input
              type="number"
              {...form.register('department_id')}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
          {createMut.isError ? (
            <p className="sm:col-span-2 text-xs text-red-600">Duplicate subject code?</p>
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
