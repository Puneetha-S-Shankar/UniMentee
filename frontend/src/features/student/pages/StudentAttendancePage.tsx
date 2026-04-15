import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { X, CalendarPlus } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';

const ATTENDANCE_THRESHOLD = 75;
const WARN_FLOOR = 65;

// ─── Types ───────────────────────────────────────────────────────────────────

interface AttendanceSessionRow {
  session_id: number;
  session_date: string;
  session_type: string;
  status: string;
  remark: string | null;
}

interface AttendanceSummary {
  offering_id: number;
  subject_code: string;
  subject_name: string;
  total_sessions: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
  sessions: AttendanceSessionRow[];
}

interface LeaveSubject {
  offering_id: number;
  subject_name: string;
}

interface LeaveRequest {
  leave_id: number;
  from_date: string;
  to_date: string;
  reason: string;
  status: string;
  applied_at: string;
  document_url: string | null;
  subjects: LeaveSubject[];
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

// ─── Helpers ───────────────────────────────────────────────────────────────────

function cardBorderClass(pct: number): string {
  if (pct >= ATTENDANCE_THRESHOLD) return 'border-emerald-400 ring-1 ring-emerald-100';
  if (pct >= WARN_FLOOR) return 'border-amber-400 ring-1 ring-amber-100';
  return 'border-red-400 ring-1 ring-red-100';
}

function sessionStatusBadge(status: string): string {
  switch (status) {
    case 'PRESENT':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'ABSENT':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'LATE':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'ON_LEAVE':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function leaveStatusBadge(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'APPROVED':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'REJECTED':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'CANCELLED':
      return 'bg-gray-100 text-gray-600 border-gray-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function formatDay(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function PercentRing({ pct }: { pct: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, pct)) / 100) * c;
  const stroke =
    pct >= ATTENDANCE_THRESHOLD ? '#10b981' : pct >= WARN_FLOOR ? '#f59e0b' : '#ef4444';

  return (
    <svg width="88" height="88" viewBox="0 0 88 88" className="flex-shrink-0">
      <circle cx="44" cy="44" r={r} fill="none" stroke="#f3f4f6" strokeWidth="8" />
      <circle
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="46" textAnchor="middle" className="fill-gray-900 text-sm font-black">
        {Math.round(pct)}%
      </text>
    </svg>
  );
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
      className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${bg}`}
      role="status"
    >
      {toast.message}
    </div>
  );
}

function SubjectDrawer({
  open,
  row,
  onClose,
}: {
  open: boolean;
  row: AttendanceSummary | null;
  onClose: () => void;
}) {
  if (!open || !row) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Close drawer"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">{row.subject_name}</h2>
            <p className="text-xs font-mono text-gray-500">{row.subject_code}</p>
            <p className="mt-2 text-2xl font-black text-gray-900">{Math.round(row.percentage)}%</p>
            <p className="text-xs text-gray-500">Overall attendance ({ATTENDANCE_THRESHOLD}% threshold)</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                <th className="pb-2 pr-2">Date</th>
                <th className="pb-2 pr-2">Day</th>
                <th className="pb-2 pr-2">Type</th>
                <th className="pb-2 pr-2">Status</th>
                <th className="pb-2">Remark</th>
              </tr>
            </thead>
            <tbody>
              {[...row.sessions]
                .sort((a, b) => a.session_date.localeCompare(b.session_date))
                .map(s => (
                  <tr key={s.session_id} className="border-b border-gray-50">
                    <td className="py-2.5 pr-2 whitespace-nowrap text-gray-800">
                      {new Date(s.session_date + 'T12:00:00').toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="py-2.5 pr-2 text-gray-600">{formatDay(s.session_date)}</td>
                    <td className="py-2.5 pr-2 text-gray-700">{s.session_type}</td>
                    <td className="py-2.5 pr-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${sessionStatusBadge(s.status)}`}
                      >
                        {s.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-gray-600">{s.remark ?? '—'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const leaveFormSchema = z
  .object({
    from_date: z.string().min(1, 'Required'),
    to_date: z.string().min(1, 'Required'),
    subject_ids: z.array(z.number()).min(1, 'Select at least one subject'),
    reason: z.string().min(10, 'At least 10 characters'),
    document_url: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const from = new Date(data.from_date + 'T12:00:00');
    const to = new Date(data.to_date + 'T12:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (from < today) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'From date must be today or later', path: ['from_date'] });
    }
    if (to < from) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'To date must be on or after from date', path: ['to_date'] });
    }
  });

type LeaveFormValues = z.infer<typeof leaveFormSchema>;

function LeaveRequestModal({
  open,
  onClose,
  offeringOptions,
  onSuccess,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  offeringOptions: { offering_id: number; label: string }[];
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}) {
  const queryClient = useQueryClient();
  const todayStr = useMemo(() => {
    const t = new Date();
    return t.toISOString().slice(0, 10);
  }, []);
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<LeaveFormValues>({
    resolver: zodResolver(leaveFormSchema),
    defaultValues: {
      from_date: '',
      to_date: '',
      subject_ids: [],
      reason: '',
      document_url: '',
    },
  });

  const mutation = useMutation({
    mutationFn: (body: {
      from_date: string;
      to_date: string;
      reason: string;
      subject_ids: number[];
      document_url?: string;
    }) => api.post('/leave-requests', body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      onSuccess('Leave request submitted');
      reset();
      onClose();
    },
    onError: (err: unknown) => {
      const data = (err as { response?: { data?: { detail?: unknown } } })?.response?.data;
      const d = data?.detail;
      let msg = 'Could not submit leave request';
      if (typeof d === 'string') msg = d;
      else if (Array.isArray(d))
        msg = d.map((e: { msg?: string }) => e.msg).filter(Boolean).join(', ') || msg;
      onError(msg);
    },
  });

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  const onSubmit = (data: LeaveFormValues) => {
    const payload: {
      from_date: string;
      to_date: string;
      reason: string;
      subject_ids: number[];
      document_url?: string;
    } = {
      from_date: data.from_date,
      to_date: data.to_date,
      reason: data.reason,
      subject_ids: data.subject_ids,
    };
    const doc = data.document_url?.trim();
    if (doc) payload.document_url = doc;
    mutation.mutate(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-gray-900">Apply for leave</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-gray-500">From</label>
              <input
                type="date"
                min={todayStr}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                {...register('from_date')}
              />
              {errors.from_date && (
                <p className="mt-1 text-xs text-red-600">{errors.from_date.message}</p>
              )}
            </div>
            <div>
              <label className="text-xs font-bold text-gray-500">To</label>
              <input type="date" className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" {...register('to_date')} />
              {errors.to_date && <p className="mt-1 text-xs text-red-600">{errors.to_date.message}</p>}
            </div>
          </div>

          <div>
            <span className="text-xs font-bold text-gray-500">Subjects</span>
            <Controller
              name="subject_ids"
              control={control}
              render={({ field }) => (
                <div className="mt-2 max-h-40 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-3">
                  {offeringOptions.length === 0 ? (
                    <p className="text-xs text-gray-400">No enrollments</p>
                  ) : (
                    offeringOptions.map(o => (
                      <label key={o.offering_id} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={field.value.includes(o.offering_id)}
                          onChange={e => {
                            const next = new Set(field.value);
                            if (e.target.checked) next.add(o.offering_id);
                            else next.delete(o.offering_id);
                            field.onChange([...next]);
                          }}
                        />
                        {o.label}
                      </label>
                    ))
                  )}
                </div>
              )}
            />
            {errors.subject_ids && (
              <p className="mt-1 text-xs text-red-600">{errors.subject_ids.message}</p>
            )}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">Reason</label>
            <textarea
              rows={4}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="Describe your reason (min. 10 characters)"
              {...register('reason')}
            />
            {errors.reason && <p className="mt-1 text-xs text-red-600">{errors.reason.message}</p>}
          </div>

          <div>
            <label className="text-xs font-bold text-gray-500">Document URL (optional)</label>
            <input
              type="url"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              placeholder="https://…"
              {...register('document_url')}
            />
            <p className="mt-1 text-[10px] text-gray-400">File upload can be wired later; paste a link for now.</p>
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
              disabled={mutation.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              {mutation.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StudentAttendancePage() {
  const canView = usePermission('ATTENDANCE_VIEW_OWN');
  const queryClient = useQueryClient();
  const [drawerRow, setDrawerRow] = useState<AttendanceSummary | null>(null);
  const [leaveTab, setLeaveTab] = useState<'pending' | 'history'>('pending');
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const dismissToast = useCallback(() => setToast(null), []);

  const { data: attendance = [], isLoading: attLoading } = useQuery<AttendanceSummary[]>({
    queryKey: ['attendance-summary'],
    queryFn: () => api.get('/students/me/attendance-summary').then(r => r.data),
    staleTime: 60_000,
    enabled: canView,
  });

  const { data: leaves = [], isLoading: leavesLoading } = useQuery<LeaveRequest[]>({
    queryKey: ['leave-requests'],
    queryFn: () => api.get('/leave-requests').then(r => r.data),
    staleTime: 60_000,
    enabled: canView,
  });

  const cancelMutation = useMutation({
    mutationFn: (leaveId: number) => api.delete(`/leave-requests/${leaveId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['leave-requests'] });
      setToast({ type: 'success', message: 'Leave request cancelled' });
    },
    onError: () => setToast({ type: 'error', message: 'Could not cancel request' }),
  });

  const pendingLeaves = useMemo(() => leaves.filter(l => l.status === 'PENDING'), [leaves]);
  const historyLeaves = useMemo(() => leaves.filter(l => l.status !== 'PENDING'), [leaves]);

  const offeringOptions = useMemo(
    () =>
      attendance.map(a => ({
        offering_id: a.offering_id,
        label: `${a.subject_name} (${a.subject_code})`,
      })),
    [attendance],
  );

  if (!canView) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm font-medium text-amber-900">
        You do not have permission to view attendance (ATTENDANCE_VIEW_OWN).
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <Toast toast={toast} onDismiss={dismissToast} />

      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Attendance</h1>
        <p className="mt-1 text-sm text-gray-500">
          Threshold: {ATTENDANCE_THRESHOLD}% (required attendance)
        </p>
      </div>

      {/* A) Summary cards */}
      {attLoading ? (
        <div className="grid animate-pulse grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-40 rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : attendance.length === 0 ? (
        <p className="text-sm text-gray-500">No enrolled subjects with sessions yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {attendance.map(row => (
            <button
              key={row.offering_id}
              type="button"
              onClick={() => setDrawerRow(row)}
              className={`flex flex-col rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition hover:shadow-md ${cardBorderClass(row.percentage)}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-extrabold text-gray-900">{row.subject_name}</p>
                  <p className="font-mono text-xs text-gray-500">{row.subject_code}</p>
                </div>
                <PercentRing pct={row.percentage} />
              </div>
              <div className="mt-3 flex gap-3 text-xs font-semibold text-gray-600">
                <span className="text-emerald-700">P {row.present}</span>
                <span className="text-red-700">A {row.absent}</span>
                <span className="text-amber-800">L {row.late}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      <SubjectDrawer open={!!drawerRow} row={drawerRow} onClose={() => setDrawerRow(null)} />

      {/* C + D) Leave section */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold text-gray-900">Leave requests</h2>
          <button
            type="button"
            onClick={() => setLeaveModalOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90"
          >
            <CalendarPlus className="h-4 w-4" />
            Apply for leave
          </button>
        </div>

        <div className="mb-4 flex gap-2 border-b border-gray-100">
          <button
            type="button"
            onClick={() => setLeaveTab('pending')}
            className={`border-b-2 px-3 py-2 text-sm font-bold ${
              leaveTab === 'pending'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Pending requests
          </button>
          <button
            type="button"
            onClick={() => setLeaveTab('history')}
            className={`border-b-2 px-3 py-2 text-sm font-bold ${
              leaveTab === 'history'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            History
          </button>
        </div>

        {leavesLoading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : leaveTab === 'pending' ? (
          pendingLeaves.length === 0 ? (
            <p className="text-sm text-gray-500">No pending requests.</p>
          ) : (
            <div className="space-y-3">
              {pendingLeaves.map(lr => (
                <div
                  key={lr.leave_id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4"
                >
                  <div>
                    <p className="text-sm font-bold text-gray-900">
                      {new Date(lr.from_date + 'T12:00:00').toLocaleDateString('en-IN')} –{' '}
                      {new Date(lr.to_date + 'T12:00:00').toLocaleDateString('en-IN')}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs text-gray-600">{lr.reason}</p>
                    <p className="mt-1 text-[10px] text-gray-400">
                      {lr.subjects.map(s => s.subject_name).join(', ') || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${leaveStatusBadge(lr.status)}`}
                    >
                      {lr.status}
                    </span>
                    <button
                      type="button"
                      onClick={() => cancelMutation.mutate(lr.leave_id)}
                      disabled={cancelMutation.isPending}
                      className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : historyLeaves.length === 0 ? (
          <p className="text-sm text-gray-500">No history yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-xs font-bold uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-2">Date range</th>
                  <th className="pb-2 pr-2">Reason</th>
                  <th className="pb-2 pr-2">Status</th>
                  <th className="pb-2">Applied on</th>
                </tr>
              </thead>
              <tbody>
                {historyLeaves.map(lr => (
                  <tr key={lr.leave_id} className="border-b border-gray-50">
                    <td className="py-3 pr-2 whitespace-nowrap text-gray-800">
                      {new Date(lr.from_date + 'T12:00:00').toLocaleDateString('en-IN')} –{' '}
                      {new Date(lr.to_date + 'T12:00:00').toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3 pr-2 text-gray-700">{lr.reason}</td>
                    <td className="py-3 pr-2">
                      <span
                        className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${leaveStatusBadge(lr.status)}`}
                      >
                        {lr.status}
                      </span>
                    </td>
                    <td className="py-3 text-gray-600">
                      {new Date(lr.applied_at).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <LeaveRequestModal
        open={leaveModalOpen}
        onClose={() => setLeaveModalOpen(false)}
        offeringOptions={offeringOptions}
        onSuccess={msg => setToast({ type: 'success', message: msg })}
        onError={msg => setToast({ type: 'error', message: msg })}
      />
    </div>
  );
}
