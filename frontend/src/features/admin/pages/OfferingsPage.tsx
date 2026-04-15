import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AxiosError } from 'axios';
import { Layers, Plus } from 'lucide-react';
import api from '../../../services/api';
import { useAnyPermission } from '../../../hooks/usePermission';

/** Mirrors backend `VALID_TRANSITIONS` in `academic_service.py`. */
const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PLANNED'],
  PLANNED: ['ACTIVE'],
  ACTIVE: ['COMPLETED', 'LOCKED'],
  LOCKED: ['ACTIVE'],
  COMPLETED: ['ARCHIVED'],
};

const STATUS_FILTER_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'DRAFT', label: 'DRAFT' },
  { value: 'PLANNED', label: 'PLANNED' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'LOCKED', label: 'LOCKED' },
  { value: 'ARCHIVED', label: 'ARCHIVED' },
] as const;

interface TermOut {
  term_id: number;
  name: string;
  academic_year_id: number;
  is_current: boolean;
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

interface SubjectOut {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  credits: number;
  subject_type: string;
  is_active: boolean;
}

export interface OfferingOut {
  offering_id: number;
  curriculum_id: number;
  batch_id: number;
  section_id: number | null;
  academic_year_id: number;
  term_id: number;
  course_lead_id?: number | null;
  status: string;
  current_enrollment: number;
  max_enrollment: number | null;
  version: number;
}

function offeringStatusBadgeClass(status: string): string {
  switch (status) {
    case 'DRAFT':
    case 'ARCHIVED':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
    case 'PLANNED':
      return 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100';
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100';
    case 'COMPLETED':
      return 'bg-teal-100 text-teal-900 dark:bg-teal-900/40 dark:text-teal-100';
    case 'LOCKED':
      return 'bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200';
  }
}

const createOfferingSchema = z.object({
  curriculum_id: z.coerce.number().int().positive('Enter curriculum id'),
  batch_id: z.coerce.number().int().positive('Select batch'),
  academic_year_id: z.coerce.number().int().positive('Enter academic year id'),
  term_id: z.coerce.number().int().positive('Select term'),
  section_id: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
  max_enrollment: z.union([z.coerce.number().int().positive(), z.literal('')]).optional(),
});

type CreateOfferingForm = z.infer<typeof createOfferingSchema>;

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

function parseApiError(err: unknown): string {
  const ax = err as AxiosError<{ detail?: unknown }>;
  const d = ax.response?.data?.detail;
  if (typeof d === 'string') return d;
  if (Array.isArray(d)) return JSON.stringify(d);
  return ax.message || 'Request failed';
}

export default function OfferingsPage() {
  const canManage = useAnyPermission(['OFFERING_MANAGE']);
  const queryClient = useQueryClient();

  const [termFilter, setTermFilter] = useState<number | 'ALL' | null>(null);
  const termInitRef = useRef(false);

  const [batchFilter, setBatchFilter] = useState<number | ''>('');
  const [sectionFilter, setSectionFilter] = useState<number | ''>('');
  const [statusFilter, setStatusFilter] = useState('');

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkTarget, setBulkTarget] = useState('');
  const [banner, setBanner] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);

  const termsQuery = useQuery({
    queryKey: ['academic', 'terms'],
    queryFn: () => api.get<TermOut[]>('/academic/terms').then((r) => r.data),
    enabled: canManage,
  });

  const batchesQuery = useQuery({
    queryKey: ['academic', 'batches'],
    queryFn: () => api.get<BatchOut[]>('/academic/batches').then((r) => r.data),
    enabled: canManage,
  });

  const sectionsQuery = useQuery({
    queryKey: ['academic', 'sections', batchFilter],
    queryFn: () =>
      api.get<SectionOut[]>('/academic/sections', { params: { batch_id: batchFilter } }).then((r) => r.data),
    enabled: canManage && batchFilter !== '',
  });

  const subjectsQuery = useQuery({
    queryKey: ['academic', 'subjects'],
    queryFn: () => api.get<SubjectOut[]>('/academic/subjects').then((r) => r.data),
    enabled: canManage,
  });

  useEffect(() => {
    if (termInitRef.current || !termsQuery.isSuccess) return;
    termInitRef.current = true;
    const list = termsQuery.data ?? [];
    if (list.length === 0) setTermFilter('ALL');
    else setTermFilter(list.find((t) => t.is_current)?.term_id ?? list[0].term_id);
  }, [termsQuery.isSuccess, termsQuery.data]);

  useEffect(() => {
    setSectionFilter('');
  }, [batchFilter]);

  const offeringsParams = useMemo(() => {
    const p: Record<string, number> = {};
    if (typeof termFilter === 'number') p.term_id = termFilter;
    if (batchFilter !== '') p.batch_id = batchFilter;
    if (sectionFilter !== '') p.section_id = sectionFilter;
    return p;
  }, [termFilter, batchFilter, sectionFilter]);

  const offeringsQuery = useQuery({
    queryKey: ['academic', 'offerings', offeringsParams],
    queryFn: () =>
      api.get<OfferingOut[]>('/academic/offerings', { params: offeringsParams }).then((r) => r.data),
    enabled: canManage && termFilter !== null,
  });

  const subjectById = useMemo(() => {
    const m = new Map<number, SubjectOut>();
    for (const s of subjectsQuery.data ?? []) m.set(s.subject_id, s);
    return m;
  }, [subjectsQuery.data]);

  const batchById = useMemo(() => {
    const m = new Map<number, BatchOut>();
    for (const b of batchesQuery.data ?? []) m.set(b.batch_id, b);
    return m;
  }, [batchesQuery.data]);

  const sectionById = useMemo(() => {
    const m = new Map<number, SectionOut>();
    for (const sec of sectionsQuery.data ?? []) m.set(sec.section_id, sec);
    return m;
  }, [sectionsQuery.data]);

  const termById = useMemo(() => {
    const m = new Map<number, TermOut>();
    for (const t of termsQuery.data ?? []) m.set(t.term_id, t);
    return m;
  }, [termsQuery.data]);

  const rows = useMemo(() => {
    const raw = offeringsQuery.data ?? [];
    if (!statusFilter) return raw;
    return raw.filter((o) => o.status === statusFilter);
  }, [offeringsQuery.data, statusFilter]);

  const invalidateOfferings = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['academic', 'offerings'] });
    queryClient.invalidateQueries({ queryKey: ['academic', 'terms'] });
  }, [queryClient]);

  const statusMutation = useMutation({
    mutationFn: async ({ offering_id, status, version }: { offering_id: number; status: string; version: number }) => {
      const { data } = await api.patch<OfferingOut>(`/academic/offerings/${offering_id}/status`, {
        status,
        version,
      });
      return data;
    },
    onSuccess: () => {
      setBanner(null);
      invalidateOfferings();
    },
    onError: (err: unknown) => {
      const ax = err as AxiosError;
      if (ax.response?.status === 409) {
        setBanner('Version conflict — please refresh');
        invalidateOfferings();
        return;
      }
      setBanner(parseApiError(err));
    },
  });

  const createForm = useForm<CreateOfferingForm>({
    resolver: zodResolver(createOfferingSchema) as Resolver<CreateOfferingForm>,
    defaultValues: {
      curriculum_id: 0,
      batch_id: 0,
      academic_year_id: 0,
      term_id: 0,
      section_id: '',
      max_enrollment: '',
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateOfferingForm) => {
      const payload: Record<string, unknown> = {
        curriculum_id: body.curriculum_id,
        batch_id: body.batch_id,
        academic_year_id: body.academic_year_id,
        term_id: body.term_id,
      };
      if (body.section_id !== '' && body.section_id !== undefined) payload.section_id = body.section_id;
      if (body.max_enrollment !== '' && body.max_enrollment !== undefined)
        payload.max_enrollment = body.max_enrollment;
      return api.post<OfferingOut>('/academic/offerings', payload).then((r) => r.data);
    },
    onSuccess: () => {
      setBanner(null);
      invalidateOfferings();
      setCreateOpen(false);
      createForm.reset({
        curriculum_id: 0,
        batch_id: 0,
        academic_year_id: 0,
        term_id: 0,
        section_id: '',
        max_enrollment: '',
      });
    },
    onError: (err: unknown) => setBanner(parseApiError(err)),
  });

  const openCreate = useCallback(() => {
    const terms = termsQuery.data ?? [];
    const defaultTerm = terms.find((t) => t.is_current)?.term_id ?? terms[0]?.term_id ?? 0;
    createForm.reset({
      curriculum_id: 0,
      batch_id: 0,
      academic_year_id: 0,
      term_id: defaultTerm,
      section_id: '',
      max_enrollment: '',
    });
    setCreateOpen(true);
  }, [createForm, termsQuery.data]);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const toggleSelectAll = () => {
    const ids = rows.map((r) => r.offering_id);
    if (selectedIds.length === ids.length && ids.length > 0) setSelectedIds([]);
    else setSelectedIds(ids);
  };

  const runBulkStatus = async () => {
    if (!bulkTarget) return;
    const selected = rows.filter((r) => selectedIds.includes(r.offering_id));
    let ok = 0;
    let skip = 0;
    let conflict = false;
    for (const o of selected) {
      const allowed = VALID_TRANSITIONS[o.status] ?? [];
      if (!allowed.includes(bulkTarget)) {
        skip += 1;
        continue;
      }
      try {
        await api.patch(`/academic/offerings/${o.offering_id}/status`, {
          status: bulkTarget,
          version: o.version,
        });
        ok += 1;
      } catch (e) {
        const ax = e as AxiosError;
        if (ax.response?.status === 409) conflict = true;
        else skip += 1;
      }
    }
    invalidateOfferings();
    setBulkOpen(false);
    setSelectedIds([]);
    const parts = [`${ok} updated`];
    if (skip) parts.push(`${skip} skipped`);
    if (conflict) parts.push('version conflict on some rows — refresh and retry');
    setBanner(parts.join('. '));
  };

  if (!canManage) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Access denied</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">You need the OFFERING_MANAGE permission.</p>
      </div>
    );
  }

  const terms = termsQuery.data ?? [];
  const batches = batchesQuery.data ?? [];
  const sections = sectionsQuery.data ?? [];

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Subject offerings</h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Filter by term and batch, manage lifecycle status, and open attendance or marks for an offering.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Create offering
        </button>
      </div>

      {banner && (
        <div
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100"
          role="status"
        >
          {banner}
          <button
            type="button"
            className="ml-3 text-amber-800 underline dark:text-amber-200"
            onClick={() => setBanner(null)}
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Term</span>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={termFilter === 'ALL' || termFilter === null ? 'ALL' : String(termFilter)}
            onChange={(e) => {
              const v = e.target.value;
              setTermFilter(v === 'ALL' ? 'ALL' : Number(v));
            }}
            disabled={termsQuery.isLoading}
          >
            {terms.length === 0 && <option value="ALL">All terms</option>}
            {terms.map((t) => (
              <option key={`${t.term_id}-${t.academic_year_id}`} value={String(t.term_id)}>
                {t.name}
                {t.is_current ? ' (current)' : ''}
              </option>
            ))}
            {terms.length > 0 && <option value="ALL">All terms</option>}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Batch</span>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={batchFilter === '' ? '' : String(batchFilter)}
            onChange={(e) => setBatchFilter(e.target.value === '' ? '' : Number(e.target.value))}
          >
            <option value="">All batches</option>
            {batches.map((b) => (
              <option key={b.batch_id} value={String(b.batch_id)}>
                Batch {b.batch_year} (#{b.batch_id})
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Section</span>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={sectionFilter === '' ? '' : String(sectionFilter)}
            onChange={(e) => setSectionFilter(e.target.value === '' ? '' : Number(e.target.value))}
            disabled={batchFilter === ''}
          >
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s.section_id} value={String(s.section_id)}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700 dark:text-gray-300">Status</span>
          <select
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={selectedIds.length === 0}
          onClick={() => setBulkOpen(true)}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-800 enabled:hover:bg-gray-50 disabled:opacity-40 dark:border-gray-600 dark:text-gray-200 dark:enabled:hover:bg-gray-800"
        >
          Bulk change status ({selectedIds.length})
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800/80">
            <tr>
              <th scope="col" className="w-10 px-3 py-3 text-left">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={rows.length > 0 && selectedIds.length === rows.length}
                  onChange={toggleSelectAll}
                  aria-label="Select all"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Subject
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Batch
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Section
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Term
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Faculty
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Status
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Enrolled
              </th>
              <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-600 dark:text-gray-400">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {offeringsQuery.isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Loading offerings…
                </td>
              </tr>
            )}
            {!offeringsQuery.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  No offerings match the filters.
                </td>
              </tr>
            )}
            {rows.map((o) => {
              const sub = subjectById.get(o.curriculum_id);
              const batch = batchById.get(o.batch_id);
              const sec = o.section_id != null ? sectionById.get(o.section_id) : undefined;
              const term = termById.get(o.term_id);
              const transitions = VALID_TRANSITIONS[o.status] ?? [];
              const subLabel = sub
                ? `${sub.subject_code} — ${sub.subject_name}`
                : `Curriculum #${o.curriculum_id}`;
              return (
                <tr key={o.offering_id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-3 py-3">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedIds.includes(o.offering_id)}
                      onChange={() => toggleSelect(o.offering_id)}
                      aria-label={`Select offering ${o.offering_id}`}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">{subLabel}</td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {batch ? `Batch ${batch.batch_year}` : `Batch #${o.batch_id}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {sec?.name ?? (o.section_id != null ? `#${o.section_id}` : '—')}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {term?.name ?? `Term ${o.term_id}`}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                    {o.course_lead_id != null ? `Faculty #${o.course_lead_id}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${offeringStatusBadgeClass(o.status)}`}
                    >
                      {o.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm tabular-nums text-gray-800 dark:text-gray-200">
                    {o.current_enrollment}
                    {o.max_enrollment != null ? ` / ${o.max_enrollment}` : ''}
                  </td>
                  <td className="px-4 py-3 text-right text-sm">
                    <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                      <select
                        className="max-w-[11rem] rounded border border-gray-300 bg-white px-2 py-1 text-xs dark:border-gray-600 dark:bg-gray-800"
                        value=""
                        onChange={(e) => {
                          const next = e.target.value;
                          if (!next) return;
                          statusMutation.mutate({
                            offering_id: o.offering_id,
                            status: next,
                            version: o.version,
                          });
                          e.target.value = '';
                        }}
                        disabled={statusMutation.isPending || transitions.length === 0}
                      >
                        <option value="">Change status…</option>
                        {transitions.map((t) => (
                          <option key={t} value={t}>
                            → {t}
                          </option>
                        ))}
                      </select>
                      <Link
                        to={`/faculty/subjects/${o.offering_id}/attendance`}
                        className="text-primary hover:underline"
                      >
                        View attendance
                      </Link>
                      <Link
                        to={`/faculty/subjects/${o.offering_id}/marks`}
                        className="text-primary hover:underline"
                      >
                        View marks
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {bulkOpen && (
        <Modal title="Bulk change status" onClose={() => setBulkOpen(false)}>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Applies the chosen status only where the transition is allowed for each row. Others are skipped.
          </p>
          <label className="mt-4 flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-800 dark:text-gray-200">New status</span>
            <select
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
              value={bulkTarget}
              onChange={(e) => setBulkTarget(e.target.value)}
            >
              <option value="">Select…</option>
              {Array.from(new Set(Object.values(VALID_TRANSITIONS).flat())).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              onClick={() => setBulkOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!bulkTarget}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
              onClick={() => void runBulkStatus()}
            >
              Apply
            </button>
          </div>
        </Modal>
      )}

      {createOpen && (
        <Modal title="Create offering" onClose={() => setCreateOpen(false)}>
          <form
            className="space-y-4"
            onSubmit={createForm.handleSubmit((data: CreateOfferingForm) =>
              createMutation.mutate(data),
            )}
          >
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Curriculum id</span>
              <input
                type="number"
                className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                {...createForm.register('curriculum_id', { valueAsNumber: true })}
              />
              {createForm.formState.errors.curriculum_id && (
                <span className="text-xs text-red-600">{createForm.formState.errors.curriculum_id.message}</span>
              )}
              <span className="text-xs text-gray-500">Maps to a subject row until curriculum API exists.</span>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Batch</span>
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                {...createForm.register('batch_id', { valueAsNumber: true })}
              >
                <option value={0}>Select batch</option>
                {batches.map((b) => (
                  <option key={b.batch_id} value={b.batch_id}>
                    Batch {b.batch_year}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Academic year id</span>
              <input
                type="number"
                className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                {...createForm.register('academic_year_id', { valueAsNumber: true })}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Term</span>
              <select
                className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                {...createForm.register('term_id', { valueAsNumber: true })}
              >
                {terms.map((t) => (
                  <option key={t.term_id} value={t.term_id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <CreateSectionOptions batchId={createForm.watch('batch_id')} form={createForm} />
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Max enrollment (optional)</span>
              <input
                type="number"
                className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
                {...createForm.register('max_enrollment')}
              />
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                className="rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
                onClick={() => setCreateOpen(false)}
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
      )}
    </div>
  );
}

function CreateSectionOptions({
  batchId,
  form,
}: {
  batchId: number;
  form: UseFormReturn<CreateOfferingForm, unknown, CreateOfferingForm>;
}) {
  const { data: sections = [], isLoading } = useQuery({
    queryKey: ['academic', 'sections', 'create-modal', batchId],
    queryFn: () =>
      api.get<SectionOut[]>('/academic/sections', { params: { batch_id: batchId } }).then((r) => r.data),
    enabled: batchId > 0,
  });

  useEffect(() => {
    form.setValue('section_id', '');
  }, [batchId, form]);

  if (batchId <= 0) return null;

  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">Section (optional)</span>
      <select
        className="rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
        {...form.register('section_id')}
        disabled={isLoading}
      >
        <option value="">None</option>
        {sections.map((s) => (
          <option key={s.section_id} value={s.section_id}>
            {s.name}
          </option>
        ))}
      </select>
    </label>
  );
}
