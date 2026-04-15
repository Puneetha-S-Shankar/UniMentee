import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  LayoutGrid,
  Table2,
  ArrowUpDown,
  ChevronDown,
} from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';
import { StudentCard, cgpaBadgeClass } from '../../../components/shared/StudentCard';

// ─── types ───────────────────────────────────────────────────────────────────

export interface MenteeRow {
  assignment_id: number;
  student: {
    student_id: number;
    usn: string;
    full_name: string;
    email: string;
    cgpa: number | null;
    batch_id: number;
    section_id: number | null;
    status?: string;
  };
  at_risk: { attendance: boolean; academic: boolean };
}

type RiskFilter = 'ALL' | 'AT_RISK' | 'NORMAL';
type SortKey = 'name_asc' | 'cgpa_desc' | 'cgpa_asc';

function isAtRisk(m: MenteeRow) {
  return m.at_risk.attendance || m.at_risk.academic;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-gray-100 ${className ?? ''}`} />;
}

// ─── page ──────────────────────────────────────────────────────────────────────

export default function MenteesListPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const canViewStudents = usePermission('STUDENT_VIEW');

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');
  const [batchFilter, setBatchFilter] = useState<number | 'ALL'>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('name_asc');
  const [view, setView] = useState<'cards' | 'table'>('cards');

  useEffect(() => {
    const f = searchParams.get('filter');
    if (f === 'at-risk') setRiskFilter('AT_RISK');
    if (f === 'normal') setRiskFilter('NORMAL');
  }, [searchParams]);

  const { data: mentees = [], isLoading } = useQuery<MenteeRow[]>({
    queryKey: ['mentor-mentees-list'],
    queryFn: () => api.get('/mentor/mentees').then((r) => r.data),
    enabled: canViewStudents,
  });

  const batchOptions = useMemo(() => {
    const ids = new Set<number>();
    for (const m of mentees) ids.add(m.student.batch_id);
    return [...ids].sort((a, b) => a - b);
  }, [mentees]);

  const filteredSorted = useMemo(() => {
    let rows = mentees;

    const q = search.trim().toLowerCase();
    if (q) {
      rows = rows.filter(
        (m) =>
          m.student.full_name.toLowerCase().includes(q) ||
          m.student.usn.toLowerCase().includes(q)
      );
    }

    if (riskFilter === 'AT_RISK') rows = rows.filter(isAtRisk);
    else if (riskFilter === 'NORMAL') rows = rows.filter((m) => !isAtRisk(m));

    if (batchFilter !== 'ALL') {
      rows = rows.filter((m) => m.student.batch_id === batchFilter);
    }

    const sorted = [...rows];
    if (sortKey === 'name_asc') {
      sorted.sort((a, b) =>
        a.student.full_name.localeCompare(b.student.full_name, undefined, { sensitivity: 'base' })
      );
    } else if (sortKey === 'cgpa_desc') {
      sorted.sort((a, b) => {
        const ca = a.student.cgpa;
        const cb = b.student.cgpa;
        if (ca == null && cb == null) return 0;
        if (ca == null) return 1;
        if (cb == null) return -1;
        return cb - ca;
      });
    } else if (sortKey === 'cgpa_asc') {
      sorted.sort((a, b) => {
        const ca = a.student.cgpa;
        const cb = b.student.cgpa;
        if (ca == null && cb == null) return 0;
        if (ca == null) return 1;
        if (cb == null) return -1;
        return ca - cb;
      });
    }

    return sorted;
  }, [mentees, search, riskFilter, batchFilter, sortKey]);

  const goToProfile = (studentId: number) => {
    navigate(`/mentor/mentees/${studentId}`);
  };

  if (!canViewStudents) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="text-gray-700">You don&apos;t have permission to view mentees.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mentees</h1>
        <p className="mt-1 text-sm text-gray-500">
          Search, filter, and open a mentee profile.
        </p>
      </div>

      {/* A) Filter & search */}
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm lg:flex-row lg:flex-wrap lg:items-end">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Name or USN"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        <div className="w-full min-w-[140px] sm:w-auto">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Risk</label>
          <div className="flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {(
              [
                ['ALL', 'All'],
                ['AT_RISK', 'At-Risk'],
                ['NORMAL', 'Normal'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setRiskFilter(key);
                  const next = new URLSearchParams(searchParams);
                  if (key === 'ALL') next.delete('filter');
                  else if (key === 'AT_RISK') next.set('filter', 'at-risk');
                  else if (key === 'NORMAL') next.set('filter', 'normal');
                  setSearchParams(next, { replace: true });
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  riskFilter === key
                    ? 'bg-white text-primary shadow-sm ring-1 ring-gray-200'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="w-full min-w-[140px] sm:w-auto">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Batch</label>
          <div className="relative">
            <select
              value={batchFilter === 'ALL' ? '' : String(batchFilter)}
              onChange={(e) => {
                const v = e.target.value;
                setBatchFilter(v === '' ? 'ALL' : Number(v));
              }}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-3 pr-9 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All batches</option>
              {batchOptions.map((id) => (
                <option key={id} value={id}>
                  Batch {id}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="w-full min-w-[180px] sm:w-auto">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Sort by</label>
          <div className="relative">
            <ArrowUpDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
              className="w-full appearance-none rounded-xl border border-gray-200 bg-white py-2.5 pl-9 pr-9 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="name_asc">Name (A–Z)</option>
              <option value="cgpa_desc">CGPA (high → low)</option>
              <option value="cgpa_asc">CGPA (low → high)</option>
            </select>
            <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1">
          <button
            type="button"
            aria-label="Card view"
            onClick={() => setView('cards')}
            className={`rounded-lg p-2 transition ${
              view === 'cards' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <LayoutGrid className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Table view"
            onClick={() => setView('table')}
            className={`rounded-lg p-2 transition ${
              view === 'table' ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            <Table2 className="h-5 w-5" />
          </button>
        </div>
      </div>

      <p className="text-sm text-gray-600">
        Showing <span className="font-semibold text-gray-900">{filteredSorted.length}</span> of{' '}
        <span className="font-semibold text-gray-900">{mentees.length}</span> mentees
      </p>

      {/* B) Content */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : mentees.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-600">No mentees assigned yet</p>
        </div>
      ) : filteredSorted.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-white py-16 text-center">
          <p className="text-gray-600">No mentees match your filters.</p>
        </div>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filteredSorted.map((m) => (
            <StudentCard
              key={m.assignment_id}
              fullName={m.student.full_name}
              usn={m.student.usn}
              batchId={m.student.batch_id}
              sectionId={m.student.section_id}
              cgpa={m.student.cgpa}
              atRiskAttendance={m.at_risk.attendance}
              atRiskAcademic={m.at_risk.academic}
              onClick={() => goToProfile(m.student.student_id)}
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/80 text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">USN</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">CGPA</th>
                  <th className="px-4 py-3">Risk status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredSorted.map((m) => (
                  <tr key={m.assignment_id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-semibold text-gray-900">{m.student.full_name}</td>
                    <td className="px-4 py-3 text-gray-600">{m.student.usn}</td>
                    <td className="px-4 py-3 text-gray-700">{m.student.batch_id}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-lg px-2.5 py-1 text-xs font-bold ring-1 ${cgpaBadgeClass(m.student.cgpa)}`}
                      >
                        {m.student.cgpa != null ? m.student.cgpa.toFixed(2) : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {isAtRisk(m) ? (
                        <div className="flex flex-wrap gap-1">
                          {m.at_risk.attendance && (
                            <span className="rounded-md bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-800">
                              Attendance
                            </span>
                          )}
                          {m.at_risk.academic && (
                            <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
                              Academic
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs font-medium text-emerald-700">Normal</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => goToProfile(m.student.student_id)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-primary/90"
                      >
                        View profile
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
