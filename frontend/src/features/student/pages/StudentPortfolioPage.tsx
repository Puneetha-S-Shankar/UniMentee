import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { QRCodeSVG } from 'qrcode.react';
import { Plus, Loader2, Copy, Check, FileText, X, ExternalLink } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';

const VERIFY_BASE = 'https://unimentee.edu/verify';

/** Must match DB / backend-allowed portfolio item types (API sends these exact strings). */
const PORTFOLIO_ITEM_TYPES = [
  'CERTIFICATE',
  'COMPETITION',
  'PUBLICATION',
  'INTERNSHIP',
  'WORKSHOP',
  'ACHIEVEMENT',
  'EXTRA_COURSE',
] as const;

type PortfolioItemTypeValue = (typeof PORTFOLIO_ITEM_TYPES)[number];
type FilterTab = 'ALL' | PortfolioItemTypeValue;

const PORTFOLIO_ITEM_TYPE_OPTIONS: { label: string; value: PortfolioItemTypeValue }[] = [
  { label: 'Certificate', value: 'CERTIFICATE' },
  { label: 'Competition', value: 'COMPETITION' },
  { label: 'Publication', value: 'PUBLICATION' },
  { label: 'Internship', value: 'INTERNSHIP' },
  { label: 'Workshop', value: 'WORKSHOP' },
  { label: 'Achievement', value: 'ACHIEVEMENT' },
  { label: 'Extra Course', value: 'EXTRA_COURSE' },
];

const PORTFOLIO_ITEM_TYPE_LABEL: Record<PortfolioItemTypeValue, string> = Object.fromEntries(
  PORTFOLIO_ITEM_TYPE_OPTIONS.map(o => [o.value, o.label]),
) as Record<PortfolioItemTypeValue, string>;

function itemTypeLabel(itemType: string): string {
  if (itemType in PORTFOLIO_ITEM_TYPE_LABEL) {
    return PORTFOLIO_ITEM_TYPE_LABEL[itemType as PortfolioItemTypeValue];
  }
  return itemType
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

interface PortfolioItem {
  item_id: number;
  item_type: string;
  title: string;
  issuing_org: string | null;
  issue_date: string;
  description: string | null;
  file_url: string;
  verification_code: string;
  status: string;
  version: number;
}

interface UploadUrlResponse {
  upload_url: string;
  file_key: string;
  public_url: string;
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

const portfolioFormSchema = z.object({
  item_type: z.enum(PORTFOLIO_ITEM_TYPES),
  title: z.string().min(1, 'Title is required'),
  issuing_org: z.string().optional(),
  issue_date: z.string().min(1, 'Date is required'),
  description: z.string().optional(),
});

type PortfolioFormValues = z.infer<typeof portfolioFormSchema>;

function itemTypeBadgeClass(t: string): string {
  switch (t) {
    case 'CERTIFICATE':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'COMPETITION':
      return 'bg-blue-100 text-blue-900 border-blue-200';
    case 'PUBLICATION':
      return 'bg-purple-100 text-purple-900 border-purple-200';
    case 'INTERNSHIP':
      return 'bg-sky-100 text-sky-900 border-sky-200';
    case 'WORKSHOP':
      return 'bg-indigo-100 text-indigo-900 border-indigo-200';
    case 'ACHIEVEMENT':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'EXTRA_COURSE':
      return 'bg-teal-100 text-teal-900 border-teal-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function statusBadge(status: string): { cls: string; label: string } {
  switch (status) {
    case 'VERIFIED':
      return { cls: 'bg-emerald-100 text-emerald-900 border-emerald-200', label: 'Verified ✓' };
    case 'REJECTED':
      return { cls: 'bg-red-100 text-red-900 border-red-200', label: 'Rejected' };
    case 'PENDING':
    default:
      return { cls: 'bg-amber-100 text-amber-900 border-amber-200', label: 'Under Review' };
  }
}

function formatIssueDate(iso: string): string {
  return new Date(iso.includes('T') ? iso : iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function isAllowedFile(f: File): boolean {
  if (f.type === 'application/pdf') return true;
  return f.type.startsWith('image/');
}

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDismiss, 4500);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  const bg = toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600';
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${bg}`}
      role="status"
    >
      {toast.message}
    </div>
  );
}

function AddPortfolioModal({
  open,
  onClose,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PortfolioFormValues>({
    resolver: zodResolver(portfolioFormSchema),
    defaultValues: {
      item_type: 'CERTIFICATE',
      title: '',
      issuing_org: '',
      issue_date: '',
      description: '',
    },
  });

  useEffect(() => {
    if (!open) {
      reset();
      setFile(null);
    }
  }, [open, reset]);

  const pickFile = useCallback(
    (f: File | null) => {
      if (!f) return;
      if (!isAllowedFile(f)) {
        onSuccess('__error__Please upload a PDF or image file');
        return;
      }
      setFile(f);
    },
    [onSuccess],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const f = e.dataTransfer.files[0];
      if (f) pickFile(f);
    },
    [pickFile],
  );

  const submit = async (data: PortfolioFormValues) => {
    if (!file) {
      onSuccess('__error__Please choose a PDF or image file');
      return;
    }
    setBusy(true);
    try {
      const contentType = file.type || 'application/octet-stream';
      const { data: presign } = await api.post<UploadUrlResponse>('/portfolio/upload-url', {
        filename: file.name.replace(/[^a-zA-Z0-9._-]/g, '_'),
        content_type: contentType,
      });

      const putRes = await fetch(presign.upload_url, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': contentType },
      });
      if (!putRes.ok) {
        throw new Error(`Upload failed (${putRes.status})`);
      }

      await api.post('/portfolio/items', {
        item_type: data.item_type,
        title: data.title,
        issuing_org: data.issuing_org?.trim() || null,
        issue_date: data.issue_date,
        description: data.description?.trim() || null,
        file_key: presign.file_key,
        file_url: presign.public_url,
      });

      await queryClient.invalidateQueries({ queryKey: ['portfolio-items'] });
      onSuccess('Portfolio item added, pending verification');
      onClose();
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object' && 'response' in e
          ? (e as { response?: { data?: { detail?: unknown } } }).response?.data?.detail
          : undefined;
      const s =
        typeof msg === 'string'
          ? msg
          : Array.isArray(msg)
            ? msg.map((x: { msg?: string }) => x.msg).join(', ')
            : e instanceof Error
              ? e.message
              : 'Something went wrong';
      onSuccess(`__error__${s}`);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900">Add portfolio item</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit(submit)}
          className="space-y-4"
        >
          <div>
            <label className="text-xs font-bold text-gray-500">Type</label>
            <select
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              {...register('item_type')}
            >
              {PORTFOLIO_ITEM_TYPE_OPTIONS.map(({ label, value }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">Title</label>
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" {...register('title')} />
            {errors.title && <p className="mt-1 text-xs text-red-600">{errors.title.message}</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">Issuing organization (optional)</label>
            <input className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" {...register('issuing_org')} />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">Issue date</label>
            <input type="date" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" {...register('issue_date')} />
            {errors.issue_date && <p className="mt-1 text-xs text-red-600">{errors.issue_date.message}</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">Description (optional)</label>
            <textarea rows={3} className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" {...register('description')} />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">File (PDF or image)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,image/*"
              className="hidden"
              onChange={e => pickFile(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              onDragOver={e => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mt-2 flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                dragOver ? 'border-primary bg-primary/5' : 'border-gray-200 bg-gray-50/80'
              }`}
            >
              <FileText className="mb-2 h-10 w-10 text-gray-400" />
              <p className="text-sm font-medium text-gray-700">Drag & drop or click to browse</p>
            </button>
            {file && (
              <p className="mt-2 text-xs text-gray-600">
                <span className="font-semibold">{file.name}</span> ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {busy ? 'Uploading…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function StudentPortfolioPage() {
  const canUpload = usePermission('PORTFOLIO_UPLOAD');
  const [filter, setFilter] = useState<FilterTab>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const { data: items = [], isLoading, error } = useQuery<PortfolioItem[]>({
    queryKey: ['portfolio-items'],
    queryFn: () => api.get('/portfolio/items').then(r => r.data),
    staleTime: 60_000,
    enabled: canUpload,
  });

  const stats = useMemo(() => {
    const total = items.length;
    const verified = items.filter(i => i.status === 'VERIFIED').length;
    const pending = items.filter(i => i.status === 'PENDING').length;
    const rejected = items.filter(i => i.status === 'REJECTED').length;
    return { total, verified, pending, rejected };
  }, [items]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter(i => i.item_type === filter);
  }, [items, filter]);

  const handleToastFromModal = useCallback((msg: string) => {
    if (msg.startsWith('__error__')) {
      setToast({ type: 'error', message: msg.replace('__error__', '') });
    } else if (msg) {
      setToast({ type: 'success', message: msg });
    }
  }, []);

  const copyCode = async (code: string, itemId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(itemId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setToast({ type: 'error', message: 'Could not copy' });
    }
  };

  if (!canUpload) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm font-medium text-amber-900">
        You do not have permission to manage portfolio items (PORTFOLIO_UPLOAD).
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800">
        Could not load portfolio. Ensure you have a student profile.
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Portfolio</h1>
          <p className="mt-1 text-sm text-gray-500">Certificates, projects, and achievements</p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          Add item
        </button>
      </div>

      {/* A) Stats */}
      {!isLoading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Total', value: stats.total, color: 'text-gray-900' },
            { label: 'Verified', value: stats.verified, color: 'text-emerald-700' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-700' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-700' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500">{s.label}</p>
              <p className={`mt-1 text-2xl font-black ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* B) Filter tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-100 pb-1">
        {(['ALL', ...PORTFOLIO_ITEM_TYPES] as const).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => setFilter(tab)}
            className={`rounded-t-lg px-3 py-2 text-sm font-bold transition ${
              filter === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {tab === 'ALL' ? 'All' : itemTypeLabel(tab)}
          </button>
        ))}
      </div>

      {/* C) Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-64 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-16 text-center">
          <p className="text-sm font-medium text-gray-600">No portfolio items yet. Add your first achievement!</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-sm text-gray-500">No items match this filter.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map(item => {
            const st = statusBadge(item.status);
            const verifyUrl = `${VERIFY_BASE}/${item.verification_code}`;
            return (
              <div
                key={item.item_id}
                className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold tracking-wide ${itemTypeBadgeClass(item.item_type)}`}
                  >
                    {itemTypeLabel(item.item_type)}
                  </span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${st.cls}`}>{st.label}</span>
                </div>
                <h3 className="mt-3 text-base font-extrabold text-gray-900">{item.title}</h3>
                {item.issuing_org && <p className="mt-1 text-sm text-gray-600">{item.issuing_org}</p>}
                <p className="mt-1 text-xs text-gray-500">{formatIssueDate(item.issue_date)}</p>

                {item.status === 'VERIFIED' && (
                  <div className="mt-4 space-y-3 rounded-lg border border-emerald-100 bg-emerald-50/50 p-3">
                    <div className="flex items-center gap-2">
                      <code className="flex-1 truncate rounded bg-white px-2 py-1 font-mono text-[10px] text-gray-800">
                        {item.verification_code}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyCode(item.verification_code, item.item_id)}
                        className="rounded-lg border border-emerald-200 bg-white p-2 text-emerald-800 hover:bg-emerald-50"
                        title="Copy code"
                      >
                        {copiedId === item.item_id ? (
                          <Check className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <div className="flex justify-center">
                      <QRCodeSVG value={verifyUrl} size={96} className="rounded-lg border border-white bg-white p-1 shadow-sm" />
                    </div>
                    <p className="text-center text-[10px] text-gray-500 break-all">{verifyUrl}</p>
                  </div>
                )}

                <a
                  href={item.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                >
                  View file <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            );
          })}
        </div>
      )}

      <AddPortfolioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={handleToastFromModal}
      />

      {/* FAB */}
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="fixed bottom-8 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:opacity-90 md:hidden"
        aria-label="Add portfolio item"
      >
        <Plus className="h-7 w-7" />
      </button>
    </div>
  );
}
