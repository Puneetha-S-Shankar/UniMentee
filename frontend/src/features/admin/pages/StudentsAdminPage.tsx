import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Download, Pencil, Plus, Search, Users } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';

// ─── types ─────────────────────────────────────────────────────────────────

export interface StudentOut {
  student_id: number;
  usn: string;
  program_id: number;
  batch_id: number;
  section_id: number | null;
  admission_date: string | null;
  current_semester_number: number | null;
  cgpa: number | null;
  status: string;
  full_name: string | null;
  email: string | null;
}

interface ProgramOut {
  program_id: number;
  name: string;
  code: string;
  degree_type: string;
  total_semesters: number;
  status: string;
}

interface BatchOut {
  batch_id: number;
  program_id: number;
  batch_year: number;
  status: string;
}

interface SectionOut {
  section_id: number;
  batch_id: number;
  name: string;
  capacity?: number | null;
  status: string;
}

const STATUS_FILTERS = [
  { value: '', label: 'All statuses' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'ALUMNI', label: 'Alumni' },
  { value: 'SUSPENDED', label: 'Suspended' },
] as const;

const createStudentSchema = z.object({
  full_name: z.string().min(1, 'Required'),
  email: z.string().email(),
  initial_password: z.string().min(8, 'At least 8 characters'),
  usn: z.string().min(1, 'Required'),
  program_id: z.coerce.number().int().positive({ message: 'Select program' }),
  batch_id: z.coerce.number().int().positive({ message: 'Select batch' }),
  section_id: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  admission_date: z.string().min(1, 'Required'),
});

type CreateStudentForm = z.infer<typeof createStudentSchema>;

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

function exportStudentsCsv(rows: StudentOut[], programName: (id: number) => string, batchLabel: (id: number) => string, sectionName: (id: number | null) => string) {
  const headers = ['USN', 'Name', 'Email', 'Program', 'Batch', 'Section', 'Semester', 'CGPA', 'Status'];
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        csvEscape(r.usn),
        csvEscape(r.full_name ?? ''),
        csvEscape(r.email ?? ''),
        csvEscape(programName(r.program_id)),
        csvEscape(batchLabel(r.batch_id)),
        csvEscape(sectionName(r.section_id)),
        r.current_semester_number ?? '',
        r.cgpa ?? '',
        csvEscape(r.status),
      ].join(','),
    ),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `students-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(s: string) {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export default function StudentsAdminPage() {
  const canManage = usePermission('STUDENT_MANAGE');
  const queryClient = useQueryClient();
  const location = useLocation();
  const navigate = useNavigate();

  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [programId, setProgramId] = useState<number | ''>('');
  const [batchId, setBatchId] = useState<number | ''>('');
  const [sectionId, setSectionId] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [sectionEdit, setSectionEdit] = useState<StudentOut | null>(null);
  const [bulkSectionOpen, setBulkSectionOpen] = useState(false);
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkSectionId, setBulkSectionId] = useState<number | ''>('');
  const [bulkStatus, setBulkStatus] = useState('ACTIVE');

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setBatchId('');
    setSectionId('');
  }, [programId]);

  useEffect(() => {
    setSectionId('');
  }, [batchId]);

  useEffect(() => {
    const st = location.state as { openCreate?: boolean } | null;
    if (st?.openCreate) {
      setCreateOpen(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, location.pathname, navigate]);

  const programsQuery = useQuery({
    queryKey: ['academic', 'programs'],
    queryFn: () => api.get<ProgramOut[]>('/academic/programs').then((r) => r.data),
    enabled: canManage,
  });

  const batchesQuery = useQuery({
    queryKey: ['academic', 'batches', programId],
    queryFn: () =>
      api
        .get<BatchOut[]>('/academic/batches', {
          params: programId !== '' ? { program_id: programId } : {},
        })
        .then((r) => r.data),
    enabled: canManage,
  });

  const sectionsFilterQuery = useQuery({
    queryKey: ['academic', 'sections', batchId],
    queryFn: () =>
      api.get<SectionOut[]>('/academic/sections', { params: { batch_id: batchId } }).then((r) => r.data),
    enabled: canManage && batchId !== '',
  });

  const studentsQuery = useQuery({
    queryKey: [
      'students',
      'list',
      { programId, batchId, sectionId, statusFilter, debouncedSearch },
    ],
    queryFn: () =>
      api
        .get<StudentOut[]>('/students', {
          params: {
            ...(programId !== '' ? { program_id: programId } : {}),
            ...(batchId !== '' ? { batch_id: batchId } : {}),
            ...(sectionId !== '' ? { section_id: sectionId } : {}),
            ...(statusFilter ? { status: statusFilter } : {}),
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          },
        })
        .then((r) => r.data),
    enabled: canManage,
  });

  const students = studentsQuery.data ?? [];

  const uniqueBatchIds = useMemo(() => [...new Set(students.map((s) => s.batch_id))], [students]);

  const allBatchesForLabels = useQuery({
    queryKey: ['academic', 'batches', 'all-for-labels'],
    queryFn: () => api.get<BatchOut[]>('/academic/batches').then((r) => r.data),
    enabled: canManage && uniqueBatchIds.length > 0,
  });

  const sectionQueries = useQueries({
    queries: uniqueBatchIds.map((bid) => ({
      queryKey: ['academic', 'sections', 'by-batch', bid],
      queryFn: () =>
        api.get<SectionOut[]>('/academic/sections', { params: { batch_id: bid } }).then((r) => r.data),
      enabled: canManage && uniqueBatchIds.length > 0,
    })),
  });

  const sectionNameById = useMemo(() => {
    const m = new Map<number, string>();
    sectionQueries.forEach((q) => {
      for (const sec of q.data ?? []) {
        m.set(sec.section_id, sec.name);
      }
    });
    return m;
  }, [sectionQueries]);

  const programs = programsQuery.data ?? [];
  const programById = useMemo(() => {
    const m = new Map<number, ProgramOut>();
    for (const p of programs) m.set(p.program_id, p);
    return m;
  }, [programs]);

  const batches = batchesQuery.data ?? [];

  const batchLabelById = useMemo(() => {
    const m = new Map<number, string>();
    const all = allBatchesForLabels.data ?? [];
    for (const bid of uniqueBatchIds) {
      const b = all.find((x) => x.batch_id === bid);
      m.set(bid, b ? `Batch ${b.batch_year}` : `#${bid}`);
    }
    return m;
  }, [uniqueBatchIds, allBatchesForLabels.data]);

  const createForm = useForm<CreateStudentForm>({
    resolver: zodResolver(createStudentSchema) as Resolver<CreateStudentForm>,
    defaultValues: {
      full_name: '',
      email: '',
      initial_password: '',
      usn: '',
      program_id: 0,
      batch_id: 0,
      section_id: '',
      admission_date: '',
    },
  });

  const wfProgram = createForm.watch('program_id');
  const wfBatch = createForm.watch('batch_id');

  const createBatchesQ = useQuery({
    queryKey: ['academic', 'batches', 'modal', wfProgram],
    queryFn: () =>
      api.get<BatchOut[]>('/academic/batches', { params: { program_id: wfProgram } }).then((r) => r.data),
    enabled: createOpen && !!wfProgram,
  });

  const createSectionsQ = useQuery({
    queryKey: ['academic', 'sections', 'modal', wfBatch],
    queryFn: () =>
      api.get<SectionOut[]>('/academic/sections', { params: { batch_id: wfBatch } }).then((r) => r.data),
    enabled: createOpen && !!wfBatch,
  });

  const createMutation = useMutation({
    mutationFn: (body: {
      full_name: string;
      email: string;
      initial_password: string;
      usn: string;
      program_id: number;
      batch_id: number;
      section_id?: number;
      admission_date: string;
    }) => api.post('/admin/students', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setCreateOpen(false);
      createForm.reset({
        full_name: '',
        email: '',
        initial_password: '',
        usn: '',
        program_id: 0,
        batch_id: 0,
        section_id: '',
        admission_date: '',
      });
      setSuccessMsg('Student created successfully.');
      window.setTimeout(() => setSuccessMsg(null), 4000);
    },
  });

  const patchMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: { section_id?: number | null; status?: string } }) =>
      api.patch<StudentOut>(`/admin/students/${id}`, body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSectionEdit(null);
      setBulkSectionOpen(false);
      setBulkStatusOpen(false);
      setSelected(new Set());
      setSuccessMsg('Updated.');
      window.setTimeout(() => setSuccessMsg(null), 3000);
    },
  });

  const toggleRow = useCallback((id: number) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);

  const toggleAll = useCallback(() => {
    if (selected.size === students.length) setSelected(new Set());
    else setSelected(new Set(students.map((s) => s.student_id)));
  }, [selected.size, students]);

  const programName = (id: number) => programById.get(id)?.name ?? `Program #${id}`;

  const selectedRows = useMemo(
    () => students.filter((s) => selected.has(s.student_id)),
    [students, selected],
  );

  const bulkSameBatch =
    selectedRows.length > 0 && selectedRows.every((s) => s.batch_id === selectedRows[0].batch_id);

  const bulkBatchId = bulkSameBatch ? selectedRows[0].batch_id : null;

  const bulkSectionsQuery = useQuery({
    queryKey: ['academic', 'sections', 'bulk', bulkBatchId],
    queryFn: () =>
      api.get<SectionOut[]>('/academic/sections', { params: { batch_id: bulkBatchId! } }).then((r) => r.data),
    enabled: bulkSectionOpen && bulkBatchId != null,
  });

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Access denied</p>
        <p className="mt-2 text-sm text-gray-500">You need STUDENT_MANAGE permission.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      {successMsg ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
          {successMsg}
        </div>
      ) : null}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Students</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage student records, sections, and status.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() =>
              exportStudentsCsv(
                students,
                programName,
                (bid) => batchLabelById.get(bid) ?? `#${bid}`,
                (sid) => (sid == null ? '' : sectionNameById.get(sid) ?? ''),
              )
            }
            disabled={students.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-100 dark:hover:bg-gray-800"
          >
            <Download className="h-4 w-4" />
            Export CSV (filtered)
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Create student
          </button>
        </div>
      </div>

      {/* A) Filters */}
      <div className="grid gap-3 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900 md:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="text-xs font-medium text-gray-500">Search</label>
          <div className="relative mt-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Name, email, or USN"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Program</label>
          <select
            value={programId === '' ? '' : String(programId)}
            onChange={(e) => setProgramId(e.target.value ? Number(e.target.value) : '')}
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
        <div>
          <label className="text-xs font-medium text-gray-500">Batch</label>
          <select
            value={batchId === '' ? '' : String(batchId)}
            onChange={(e) => setBatchId(e.target.value ? Number(e.target.value) : '')}
            className="mt-1 w-full rounded-lg border border-gray-300 py-2 px-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
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
          <label className="text-xs font-medium text-gray-500">Section</label>
          <select
            value={sectionId === '' ? '' : String(sectionId)}
            onChange={(e) => setSectionId(e.target.value ? Number(e.target.value) : '')}
            disabled={batchId === ''}
            className="mt-1 w-full rounded-lg border border-gray-300 py-2 px-3 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            <option value="">{batchId === '' ? 'Select batch first' : 'All sections'}</option>
            {(sectionsFilterQuery.data ?? []).map((s) => (
              <option key={s.section_id} value={s.section_id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-300 py-2 px-3 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            {STATUS_FILTERS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk toolbar */}
      {selected.size > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2 text-sm">
          <Users className="h-4 w-4 text-primary" />
          <span className="font-medium">{selected.size} selected</span>
          <button
            type="button"
            disabled={!bulkSameBatch}
            onClick={() => {
              setBulkSectionId('');
              setBulkSectionOpen(true);
            }}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-600"
            title={bulkSameBatch ? '' : 'Select students from the same batch only'}
          >
            Reassign section
          </button>
          <button
            type="button"
            onClick={() => setBulkStatusOpen(true)}
            className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium dark:border-gray-600"
          >
            Change status
          </button>
          <button
            type="button"
            onClick={() =>
              exportStudentsCsv(
                selectedRows,
                programName,
                (bid) => batchLabelById.get(bid) ?? `#${bid}`,
                (sid) => (sid == null ? '' : sectionNameById.get(sid) ?? ''),
              )
            }
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-xs font-medium dark:border-gray-600"
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </button>
        </div>
      ) : null}

      {/* B) Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        {studentsQuery.isLoading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading…</div>
        ) : studentsQuery.isError ? (
          <div className="p-12 text-center text-sm text-red-600">Could not load students.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-left text-sm">
              <thead className="border-b border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-950/50">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={students.length > 0 && selected.size === students.length}
                      onChange={toggleAll}
                      className="rounded border-gray-300"
                    />
                  </th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">USN</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">Name</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">Program</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">Batch</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">Section</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">Semester</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">CGPA</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">Status</th>
                  <th className="px-3 py-3 font-semibold text-gray-700 dark:text-gray-200">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {students.map((s) => (
                  <tr key={s.student_id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40">
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selected.has(s.student_id)}
                        onChange={() => toggleRow(s.student_id)}
                        className="rounded border-gray-300"
                      />
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-800 dark:text-gray-100">{s.usn}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-900 dark:text-white">{s.full_name ?? '—'}</div>
                      <div className="text-xs text-gray-500">{s.email ?? ''}</div>
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{programName(s.program_id)}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {batchLabelById.get(s.batch_id) ?? `Batch #${s.batch_id}`}
                    </td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">
                      {s.section_id != null ? (sectionNameById.get(s.section_id) ?? `#${s.section_id}`) : '—'}
                    </td>
                    <td className="px-3 py-2">{s.current_semester_number ?? '—'}</td>
                    <td className="px-3 py-2">{s.cgpa ?? '—'}</td>
                    <td className="px-3 py-2">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">
                        {s.status}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        <Link
                          to={`/admin/students/${s.student_id}`}
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          View profile
                        </Link>
                        <button
                          type="button"
                          onClick={() => setSectionEdit(s)}
                          className="inline-flex items-center gap-0.5 text-xs text-gray-600 hover:text-gray-900 dark:text-gray-400"
                        >
                          <Pencil className="h-3 w-3" />
                          Section
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {students.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-500">No students match filters.</div>
            ) : null}
          </div>
        )}
      </div>

      {/* Create modal */}
      {createOpen ? (
        <Modal title="Create student" onClose={() => setCreateOpen(false)}>
          <form
            className="space-y-3"
            onSubmit={createForm.handleSubmit((data) => {
              const section_id =
                data.section_id === '' || data.section_id === undefined ? undefined : Number(data.section_id);
              createMutation.mutate({
                full_name: data.full_name,
                email: data.email,
                initial_password: data.initial_password,
                usn: data.usn,
                program_id: data.program_id,
                batch_id: data.batch_id,
                admission_date: data.admission_date,
                ...(section_id != null ? { section_id } : {}),
              });
            })}
          >
            <p className="text-xs font-semibold uppercase text-gray-500">Personal</p>
            <input
              {...createForm.register('full_name')}
              placeholder="Full name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
            {createForm.formState.errors.full_name ? (
              <p className="text-xs text-red-600">{createForm.formState.errors.full_name.message}</p>
            ) : null}
            <input
              type="email"
              {...createForm.register('email')}
              placeholder="Email"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
            <input
              type="password"
              {...createForm.register('initial_password')}
              placeholder="Initial password"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
            <p className="text-xs font-semibold uppercase text-gray-500">Academic</p>
            <input
              {...createForm.register('usn')}
              placeholder="USN (unique)"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
            <select
              {...createForm.register('program_id', { valueAsNumber: true })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            >
              <option value={0}>Program</option>
              {programs.map((p) => (
                <option key={p.program_id} value={p.program_id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select
              {...createForm.register('batch_id', { valueAsNumber: true })}
              disabled={!wfProgram}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm disabled:opacity-50 dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            >
              <option value={0}>Batch</option>
              {(createBatchesQ.data ?? []).map((b) => (
                <option key={b.batch_id} value={b.batch_id}>
                  Batch {b.batch_year}
                </option>
              ))}
            </select>
            <select {...createForm.register('section_id')} className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white">
              <option value="">Section (optional)</option>
              {(createSectionsQ.data ?? []).map((sec) => (
                <option key={sec.section_id} value={sec.section_id}>
                  {sec.name}
                </option>
              ))}
            </select>
            <label className="text-xs text-gray-500">Admission date</label>
            <input
              type="date"
              {...createForm.register('admission_date')}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
            />
            {createMutation.isError ? (
              <p className="text-xs text-red-600">Create failed (duplicate email/USN?).</p>
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
                disabled={createMutation.isPending}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {createMutation.isPending ? 'Creating…' : 'Create'}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {/* Quick section edit */}
      {sectionEdit ? (
        <Modal title="Edit section" onClose={() => setSectionEdit(null)}>
          <SectionReassignForm
            key={sectionEdit.student_id}
            batchId={sectionEdit.batch_id}
            currentSectionId={sectionEdit.section_id}
            onCancel={() => setSectionEdit(null)}
            onSave={(sid) =>
              patchMutation.mutate({
                id: sectionEdit.student_id,
                body: { section_id: sid },
              })
            }
            isPending={patchMutation.isPending}
          />
        </Modal>
      ) : null}

      {/* Bulk section */}
      {bulkSectionOpen && bulkBatchId != null ? (
        <Modal title="Reassign section (bulk)" onClose={() => setBulkSectionOpen(false)}>
          <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
            Applies to {selectedRows.length} student(s) in the same batch.
          </p>
          <select
            value={bulkSectionId === '' ? '' : String(bulkSectionId)}
            onChange={(e) => setBulkSectionId(e.target.value ? Number(e.target.value) : '')}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            <option value="">— None —</option>
            {(bulkSectionsQuery.data ?? []).map((sec) => (
              <option key={sec.section_id} value={sec.section_id}>
                {sec.name}
              </option>
            ))}
          </select>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBulkSectionOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={patchMutation.isPending}
              onClick={async () => {
                const sid = bulkSectionId === '' ? null : Number(bulkSectionId);
                for (const row of selectedRows) {
                  await api.patch(`/admin/students/${row.student_id}`, { section_id: sid });
                }
                queryClient.invalidateQueries({ queryKey: ['students'] });
                setBulkSectionOpen(false);
                setSelected(new Set());
                setSuccessMsg('Sections updated.');
                window.setTimeout(() => setSuccessMsg(null), 3000);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </Modal>
      ) : null}

      {/* Bulk status */}
      {bulkStatusOpen ? (
        <Modal title="Change status (bulk)" onClose={() => setBulkStatusOpen(false)}>
          <select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
          >
            {STATUS_FILTERS.filter((x) => x.value).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setBulkStatusOpen(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={patchMutation.isPending}
              onClick={async () => {
                for (const row of selectedRows) {
                  await api.patch(`/admin/students/${row.student_id}`, { status: bulkStatus });
                }
                queryClient.invalidateQueries({ queryKey: ['students'] });
                setBulkStatusOpen(false);
                setSelected(new Set());
                setSuccessMsg('Status updated.');
                window.setTimeout(() => setSuccessMsg(null), 3000);
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

function SectionReassignForm({
  batchId,
  currentSectionId,
  onCancel,
  onSave,
  isPending,
}: {
  batchId: number;
  currentSectionId: number | null;
  onCancel: () => void;
  onSave: (sectionId: number | null) => void;
  isPending: boolean;
}) {
  const q = useQuery({
    queryKey: ['academic', 'sections', 'edit', batchId],
    queryFn: () =>
      api.get<SectionOut[]>('/academic/sections', { params: { batch_id: batchId } }).then((r) => r.data),
  });
  const [val, setVal] = useState<string>(currentSectionId != null ? String(currentSectionId) : '');
  return (
    <div className="space-y-3">
      <select
        value={val}
        onChange={(e) => setVal(e.target.value)}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950 dark:text-white"
      >
        <option value="">— None —</option>
        {(q.data ?? []).map((s) => (
          <option key={s.section_id} value={s.section_id}>
            {s.name}
          </option>
        ))}
      </select>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={isPending}
          onClick={() => onSave(val === '' ? null : Number(val))}
          className="rounded-lg bg-primary px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Save
        </button>
      </div>
    </div>
  );
}
