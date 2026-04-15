import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Download, ScrollText } from 'lucide-react';
import api from '../../../services/api';
import { useAnyPermission } from '../../../hooks/usePermission';

// ─── types ─────────────────────────────────────────────────────────────────

export interface AuditLogRow {
  log_id: number;
  actor_name: string | null;
  actor_user_id: number | null;
  actor_roles: string[];
  action: string;
  entity_type: string;
  entity_id: number | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
  ip_address: string | null;
}

interface AuditLogPageResponse {
  logs: AuditLogRow[];
  next_cursor: string | null;
}

// ─── constants ─────────────────────────────────────────────────────────────

const ENTITY_TYPES = [
  { value: '', label: 'All' },
  { value: 'students', label: 'students' },
  { value: 'assessments', label: 'assessments' },
  { value: 'attendance_sessions', label: 'attendance_sessions' },
  { value: 'portfolio_items', label: 'portfolio_items' },
  { value: 'mentor_assignments', label: 'mentor_assignments' },
  { value: 'subject_offerings', label: 'subject_offerings' },
  { value: 'users', label: 'users' },
] as const;

const ACTION_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'CREATE', label: 'CREATE' },
  { value: 'UPDATE', label: 'UPDATE' },
  { value: 'DELETE', label: 'DELETE' },
] as const;

const LIMIT = 50;

// ─── helpers ───────────────────────────────────────────────────────────────

function formatAuditTimestamp(iso: string): string {
  const d = new Date(iso);
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()} ${pad(d.getHours())}:${pad(
    d.getMinutes(),
  )}:${pad(d.getSeconds())}`;
}

function csvEscape(s: string) {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function collectKeys(
  a: Record<string, unknown> | null,
  b: Record<string, unknown> | null,
): string[] {
  const s = new Set<string>();
  if (a) Object.keys(a).forEach((k) => s.add(k));
  if (b) Object.keys(b).forEach((k) => s.add(k));
  return Array.from(s).sort();
}

function jsonStable(v: unknown): string {
  return JSON.stringify(v);
}

function valuesDiffer(oldVal: unknown, newVal: unknown): boolean {
  return jsonStable(oldVal) !== jsonStable(newVal);
}

function actionBadgeClass(action: string) {
  switch (action) {
    case 'CREATE':
      return 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100';
    case 'UPDATE':
      return 'bg-blue-100 text-blue-900 dark:bg-blue-900/40 dark:text-blue-100';
    case 'DELETE':
      return 'bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-100';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200';
  }
}

function JsonDiffTable({
  oldVal,
  newVal,
}: {
  oldVal: Record<string, unknown> | null;
  newVal: Record<string, unknown> | null;
}) {
  if (!oldVal && !newVal) {
    return <p className="text-sm text-gray-500 dark:text-gray-400">—</p>;
  }
  const keys = collectKeys(oldVal, newVal);
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
      <table className="min-w-full divide-y divide-gray-200 text-left text-xs dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800/80">
          <tr>
            <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">Key</th>
            <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">Previous</th>
            <th className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">New</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
          {keys.map((key) => {
            const ov = oldVal?.[key];
            const nv = newVal?.[key];
            const changed = valuesDiffer(ov, nv);
            return (
              <tr
                key={key}
                className={
                  changed
                    ? 'bg-amber-50 dark:bg-amber-950/30'
                    : 'bg-white dark:bg-gray-900/40'
                }
              >
                <td className="whitespace-nowrap px-3 py-2 font-mono text-gray-800 dark:text-gray-200">
                  {key}
                </td>
                <td className="break-all px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                  {ov === undefined ? '—' : JSON.stringify(ov, null, 2)}
                </td>
                <td className="break-all px-3 py-2 font-mono text-gray-700 dark:text-gray-300">
                  {nv === undefined ? '—' : JSON.stringify(nv, null, 2)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function exportAuditCsv(rows: AuditLogRow[]) {
  const headers = [
    'Timestamp',
    'Actor',
    'Roles',
    'Action',
    'Entity Type',
    'Entity ID',
    'IP Address',
    'Old JSON',
    'New JSON',
  ];
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
      [
        csvEscape(formatAuditTimestamp(r.created_at)),
        csvEscape(r.actor_name ?? ''),
        csvEscape(r.actor_roles.join('; ')),
        csvEscape(r.action),
        csvEscape(r.entity_type),
        r.entity_id != null ? String(r.entity_id) : '',
        csvEscape(r.ip_address ?? ''),
        csvEscape(r.old_value ? JSON.stringify(r.old_value) : ''),
        csvEscape(r.new_value ? JSON.stringify(r.new_value) : ''),
      ].join(','),
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function AuditLogPage() {
  const canView = useAnyPermission(['AUDIT_VIEW', 'ORG_VIEW']);

  const [entityType, setEntityType] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [actorInput, setActorInput] = useState('');
  const [debouncedActor, setDebouncedActor] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedActor(actorInput.trim()), 400);
    return () => window.clearTimeout(t);
  }, [actorInput]);

  const filterKey = useMemo(
    () => ({
      entityType,
      actionFilter,
      debouncedActor,
      fromDate,
      toDate,
    }),
    [entityType, actionFilter, debouncedActor, fromDate, toDate],
  );

  const query = useInfiniteQuery({
    queryKey: ['admin', 'audit-logs', filterKey],
    queryFn: async ({ pageParam }: { pageParam: string | undefined }) => {
      const params: Record<string, string | number> = { limit: LIMIT };
      if (filterKey.entityType) params.entity_type = filterKey.entityType;
      if (filterKey.actionFilter) params.action = filterKey.actionFilter;
      if (filterKey.debouncedActor) params.actor_name = filterKey.debouncedActor;
      if (filterKey.fromDate) params.from_date = filterKey.fromDate;
      if (filterKey.toDate) params.to_date = filterKey.toDate;
      if (pageParam) params.cursor = pageParam;
      const { data } = await api.get<AuditLogPageResponse>('/admin/audit-logs', { params });
      return data;
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    enabled: canView,
  });

  const rows = useMemo(
    () => query.data?.pages.flatMap((p) => p.logs) ?? [],
    [query.data?.pages],
  );

  const toggleRow = useCallback((logId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) next.delete(logId);
      else next.add(logId);
      return next;
    });
  }, []);

  if (!canView) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="text-lg font-medium text-gray-900 dark:text-white">Access denied</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          You need AUDIT_VIEW or ORG_VIEW to view this page.
        </p>
      </div>
    );
  }

  const loading = query.isLoading;
  const fetchingMore = query.isFetchingNextPage;
  const empty = !loading && rows.length === 0;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900 dark:text-white">
            <ScrollText className="h-8 w-8 text-primary" />
            Audit log
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Immutable record of changes across the university workspace.
          </p>
        </div>
        <button
          type="button"
          onClick={() => exportAuditCsv(rows)}
          disabled={rows.length === 0}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200 dark:hover:bg-gray-800"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">
              Entity type
            </span>
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
            >
              {ENTITY_TYPES.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Action</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
            >
              {ACTION_OPTIONS.map((o) => (
                <option key={o.value || 'all-a'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">Actor</span>
            <input
              type="search"
              placeholder="Search by name"
              value={actorInput}
              onChange={(e) => setActorInput(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">From</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700 dark:text-gray-300">To</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-950"
            />
          </label>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading…</div>
        ) : empty ? (
          <div className="p-12 text-center text-sm text-gray-500 dark:text-gray-400">
            No audit logs found for the selected filters
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm dark:divide-gray-800">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr>
                  <th className="w-10 px-2 py-3" aria-hidden />
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    Timestamp
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Actor</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">Action</th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    Entity type
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    Entity ID
                  </th>
                  <th className="px-4 py-3 font-semibold text-gray-700 dark:text-gray-200">
                    IP address
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {rows.map((r) => {
                  const open = expanded.has(r.log_id);
                  return (
                    <Fragment key={r.log_id}>
                      <tr
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        onClick={() => toggleRow(r.log_id)}
                      >
                        <td className="px-2 py-3 text-gray-500">
                          {open ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-800 dark:text-gray-200">
                          {formatAuditTimestamp(r.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              {r.actor_name ?? '—'}
                            </span>
                            {r.actor_roles.map((role) => (
                              <span
                                key={role}
                                className="rounded bg-gray-100 px-1.5 py-0.5 text-xs font-medium text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                              >
                                {role}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${actionBadgeClass(
                              r.action,
                            )}`}
                          >
                            {r.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-800 dark:text-gray-200">{r.entity_type}</td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700 dark:text-gray-300">
                          {r.entity_id ?? '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {r.ip_address ?? '—'}
                        </td>
                      </tr>
                      {open ? (
                        <tr className="bg-gray-50/80 dark:bg-gray-950/40">
                          <td colSpan={7} className="px-4 py-4">
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Change detail
                            </p>
                            <JsonDiffTable oldVal={r.old_value} newVal={r.new_value} />
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!empty && query.hasNextPage ? (
          <div className="border-t border-gray-200 p-4 text-center dark:border-gray-800">
            <button
              type="button"
              onClick={() => query.fetchNextPage()}
              disabled={fetchingMore}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
            >
              {fetchingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
