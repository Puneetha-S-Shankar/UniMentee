import { useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQueries, useQuery } from '@tanstack/react-query';
import { ChevronLeft, Download } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';

const SESSION_TYPE_FILTERS = ['ALL', 'ACADEMIC', 'PERSONAL', 'CAREER', 'DISCIPLINARY', 'GENERAL'] as const;

interface AssignmentOut {
  assignment_id: number;
  student_id: number;
  mentor_user_id: number;
  status: string;
}

export interface MentorSessionOut {
  session_id: number;
  assignment_id: number;
  session_date: string;
  session_time?: string | null;
  duration_minutes?: number | null;
  session_type: string;
  topics_discussed?: string | null;
  action_items?: string | null;
  follow_up_required: boolean;
  follow_up_date?: string | null;
  career_notes?: string | null;
}

interface MenteeRow {
  assignment_id: number;
  student: { student_id: number; full_name: string; usn: string };
}

export type FlatSessionRow = MentorSessionOut & {
  student_id: number;
  student_name: string;
  usn: string;
};

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function parseIsoDate(s: string) {
  return new Date(s.length <= 10 ? `${s}T12:00:00` : s);
}

/** Amber overdue: follow-up date passed and no later session on same assignment (mirrors dashboard rules). */
function isFollowUpOverdue(
  s: MentorSessionOut,
  sameAssignmentSessions: MentorSessionOut[]
): boolean {
  if (!s.follow_up_required || !s.follow_up_date) return false;
  const today = startOfDay(new Date());
  const fu = startOfDay(parseIsoDate(s.follow_up_date));
  if (fu >= today) return false;
  const hasLater = sameAssignmentSessions.some(
    (o) =>
      o.session_id !== s.session_id &&
      parseIsoDate(o.session_date) >= fu
  );
  return !hasLater;
}

function matchesSessionTypeFilter(row: MentorSessionOut, filter: (typeof SESSION_TYPE_FILTERS)[number]) {
  if (filter === 'ALL') return true;
  const t = (row.session_type || '').toUpperCase();
  if (filter === 'GENERAL') return t === 'GENERAL' || t === 'IN_PERSON';
  return t === filter;
}

function escapeCsvCell(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function buildCsv(rows: FlatSessionRow[]) {
  const headers = [
    'Date',
    'Mentee',
    'USN',
    'Session Type',
    'Topics',
    'Follow-up Date',
    'Follow-up Required',
    'Assignment ID',
    'Session ID',
  ];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        escapeCsvCell(r.session_date),
        escapeCsvCell(r.student_name),
        escapeCsvCell(r.usn),
        escapeCsvCell(r.session_type || ''),
        escapeCsvCell((r.topics_discussed || '').replace(/\r?\n/g, ' ')),
        escapeCsvCell(r.follow_up_date || ''),
        escapeCsvCell(String(r.follow_up_required)),
        escapeCsvCell(String(r.assignment_id)),
        escapeCsvCell(String(r.session_id)),
      ].join(',')
    );
  }
  return lines.join('\r\n');
}

export default function SessionsPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const canView = usePermission('STUDENT_VIEW');

  const period = searchParams.get('period');
  const filterPending = searchParams.get('filter') === 'pending';

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [typeFilter, setTypeFilter] = useState<(typeof SESSION_TYPE_FILTERS)[number]>('ALL');
  const [pendingOnly, setPendingOnly] = useState(false);

  const { data: assignments = [], isLoading: aLoading } = useQuery<AssignmentOut[]>({
    queryKey: ['mentor-assignments-sessions-page'],
    queryFn: () => api.get('/mentor/assignments').then((r) => r.data),
    enabled: canView,
  });

  const { data: mentees = [] } = useQuery<MenteeRow[]>({
    queryKey: ['mentor-mentees-sessions-page'],
    queryFn: () => api.get('/mentor/mentees').then((r) => r.data),
    enabled: canView,
  });

  const studentMeta = useMemo(() => {
    const m = new Map<number, { name: string; usn: string }>();
    for (const row of mentees) {
      m.set(row.student.student_id, {
        name: row.student.full_name,
        usn: row.student.usn,
      });
    }
    return m;
  }, [mentees]);

  const sessionQueries = useQueries({
    queries: assignments.map((a) => ({
      queryKey: ['mentor-assignment-sessions', a.assignment_id] as const,
      queryFn: () =>
        api
          .get<MentorSessionOut[]>(`/mentor/assignments/${a.assignment_id}/sessions`)
          .then((r) => r.data),
      enabled: canView && assignments.length > 0,
    })),
  });

  const sessionsLoading = aLoading || sessionQueries.some((q) => q.isLoading);

  const byAssignment = useMemo(() => {
    const m = new Map<number, MentorSessionOut[]>();
    for (let i = 0; i < assignments.length; i++) {
      m.set(assignments[i].assignment_id, sessionQueries[i]?.data ?? []);
    }
    return m;
  }, [assignments, sessionQueries]);

  const flat: FlatSessionRow[] = useMemo(() => {
    const rows: FlatSessionRow[] = [];
    for (const a of assignments) {
      const list = byAssignment.get(a.assignment_id) ?? [];
      const meta = studentMeta.get(a.student_id);
      const name = meta?.name ?? 'Unknown';
      const usn = meta?.usn ?? '—';
      for (const s of list) {
        rows.push({ ...s, student_id: a.student_id, student_name: name, usn });
      }
    }
    rows.sort(
      (x, y) =>
        new Date(y.session_date).getTime() - new Date(x.session_date).getTime()
    );
    return rows;
  }, [assignments, byAssignment, studentMeta]);

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const filtered = useMemo(() => {
    let list = flat;
    if (period === 'month') {
      list = list.filter((s) => new Date(s.session_date) >= startOfMonth);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (s) =>
          s.student_name.toLowerCase().includes(q) ||
          s.usn.toLowerCase().includes(q)
      );
    }
    if (dateFrom) {
      const from = startOfDay(parseIsoDate(dateFrom));
      list = list.filter((s) => startOfDay(parseIsoDate(s.session_date)) >= from);
    }
    if (dateTo) {
      const to = startOfDay(parseIsoDate(dateTo));
      list = list.filter((s) => startOfDay(parseIsoDate(s.session_date)) <= to);
    }
    if (typeFilter !== 'ALL') {
      list = list.filter((s) => matchesSessionTypeFilter(s, typeFilter));
    }
    if (pendingOnly) {
      list = list.filter((s) => {
        const same = byAssignment.get(s.assignment_id) ?? [];
        return isFollowUpOverdue(s, same);
      });
    }
    return list;
  }, [flat, period, search, dateFrom, dateTo, typeFilter, pendingOnly, startOfMonth, byAssignment]);

  const exportCsv = useCallback(() => {
    const blob = new Blob([buildCsv(filtered)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mentor-sessions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [filtered]);

  if (!canView) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm text-amber-900">
        You need <strong>STUDENT_VIEW</strong> to view mentoring sessions.
      </div>
    );
  }

  const title = filterPending
    ? 'Sessions & follow-ups'
    : period === 'month'
      ? 'Sessions this month'
      : 'All sessions';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/mentor/dashboard"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
          <p className="mt-1 text-sm text-gray-500">
            All mentoring sessions across your assignments. Filter and export as needed.
          </p>
        </div>
        <button
          type="button"
          onClick={exportCsv}
          disabled={!filtered.length}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-800 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {/* A) Filter bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[200px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Search mentee</label>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or USN"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Session type</label>
          <select
            value={typeFilter}
            onChange={(e) =>
              setTypeFilter(e.target.value as (typeof SESSION_TYPE_FILTERS)[number])
            }
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {SESSION_TYPE_FILTERS.map((t) => (
              <option key={t} value={t}>
                {t === 'ALL' ? 'All types' : t}
              </option>
            ))}
          </select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
          <input
            type="checkbox"
            checked={pendingOnly}
            onChange={(e) => setPendingOnly(e.target.checked)}
            className="rounded border-gray-300 text-primary focus:ring-primary"
          />
          Has overdue follow-up
        </label>
      </div>

      {/* B) Table */}
      {sessionsLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      ) : flat.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-600">
          No sessions recorded yet
        </p>
      ) : filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center text-sm text-gray-600">
          No sessions match your filters
        </p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/90 text-xs font-bold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Mentee</th>
                  <th className="px-4 py-3">Session type</th>
                  <th className="px-4 py-3">Topics</th>
                  <th className="px-4 py-3">Follow-up date</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((row) => {
                  const same = byAssignment.get(row.assignment_id) ?? [];
                  const overdue = isFollowUpOverdue(row, same);
                  const topics = (row.topics_discussed || '').trim();
                  const topicsShort = topics.length > 80 ? `${topics.slice(0, 80)}…` : topics;
                  return (
                    <tr key={`${row.session_id}-${row.assignment_id}`} className="hover:bg-gray-50/80">
                      <td className="whitespace-nowrap px-4 py-3 text-gray-800">
                        {parseIsoDate(row.session_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{row.student_name}</p>
                        <p className="font-mono text-xs text-gray-500">{row.usn}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-800">
                          {row.session_type || '—'}
                        </span>
                      </td>
                      <td className="max-w-xs px-4 py-3 text-gray-600" title={topics || undefined}>
                        {topicsShort || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {row.follow_up_date ? (
                          <span
                            className={
                              overdue ? 'font-semibold text-amber-700' : 'text-gray-700'
                            }
                          >
                            {parseIsoDate(row.follow_up_date).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(
                              `/mentor/sessions/new?assignmentId=${row.assignment_id}&studentId=${row.student_id}`
                            )
                          }
                          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary/90"
                        >
                          Add follow-up session
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
