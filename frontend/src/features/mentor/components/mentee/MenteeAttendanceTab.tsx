import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { AttendanceSummary } from './types';

const ATTENDANCE_THRESHOLD = 75;
const WARN_FLOOR = 65;

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

function formatDay(isoDate: string): string {
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('en-IN', { weekday: 'short' });
}

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
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Close" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-gray-900">{row.subject_name}</h2>
            <p className="font-mono text-xs text-gray-500">{row.subject_code}</p>
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
                .map((s) => (
                  <tr key={s.session_id} className="border-b border-gray-50">
                    <td className="whitespace-nowrap py-2.5 pr-2 text-gray-800">
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

export function MenteeAttendanceTab({ rows }: { rows: AttendanceSummary[] }) {
  const [drawer, setDrawer] = useState<AttendanceSummary | null>(null);
  const openDrawer = useCallback((r: AttendanceSummary) => setDrawer(r), []);
  const closeDrawer = useCallback(() => setDrawer(null), []);

  if (!rows.length) {
    return (
      <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
        No attendance data for this mentee.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <button
            key={row.offering_id}
            type="button"
            onClick={() => openDrawer(row)}
            className={`flex gap-4 rounded-2xl border-2 bg-white p-4 text-left shadow-sm transition hover:shadow-md ${cardBorderClass(row.percentage)}`}
          >
            <PercentRing pct={row.percentage} />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{row.subject_name}</p>
              <p className="font-mono text-xs text-gray-500">{row.subject_code}</p>
              <p className="mt-2 text-xs text-gray-500">
                {row.present + row.late} / {row.total_sessions} attended
              </p>
            </div>
          </button>
        ))}
      </div>
      <SubjectDrawer open={!!drawer} row={drawer} onClose={closeDrawer} />
    </>
  );
}
