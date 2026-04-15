import type { ReactNode } from 'react';

const AVATAR_PALETTE = [
  'bg-violet-100 text-violet-700 ring-violet-200/60',
  'bg-blue-100 text-blue-700 ring-blue-200/60',
  'bg-emerald-100 text-emerald-700 ring-emerald-200/60',
  'bg-amber-100 text-amber-800 ring-amber-200/60',
  'bg-rose-100 text-rose-700 ring-rose-200/60',
  'bg-cyan-100 text-cyan-800 ring-cyan-200/60',
];

function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function cgpaBadgeClass(cgpa: number | null | undefined): string {
  if (cgpa == null) return 'bg-gray-100 text-gray-600 ring-gray-200/80';
  if (cgpa >= 7.0) return 'bg-emerald-100 text-emerald-800 ring-emerald-200/80';
  if (cgpa >= 5.5) return 'bg-amber-100 text-amber-900 ring-amber-200/80';
  return 'bg-red-100 text-red-800 ring-red-200/80';
}

export interface StudentCardProps {
  fullName: string;
  usn: string;
  batchId: number;
  sectionId: number | null;
  cgpa: number | null;
  atRiskAttendance: boolean;
  atRiskAcademic: boolean;
  onClick?: () => void;
  className?: string;
  footer?: ReactNode;
}

/**
 * Compact mentee/student summary for grid layouts (mentor flows).
 */
export function StudentCard({
  fullName,
  usn,
  batchId,
  sectionId,
  cgpa,
  atRiskAttendance,
  atRiskAcademic,
  onClick,
  className = '',
  footer,
}: StudentCardProps) {
  const atRisk = atRiskAttendance || atRiskAcademic;
  const palette = AVATAR_PALETTE[hashName(fullName) % AVATAR_PALETTE.length];
  const cgpaLabel = cgpa != null ? cgpa.toFixed(2) : '—';

  const inner = (
    <>
      {atRisk && (
        <span
          className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white"
          title="At risk"
          aria-hidden
        />
      )}
      <div className="flex gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold ring-2 ${palette}`}
        >
          {initials(fullName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-gray-900">{fullName}</p>
          <p className="truncate text-xs text-gray-500">{usn}</p>
          {atRisk && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {atRiskAttendance && (
                <span className="rounded-md bg-red-50 px-2 py-0.5 text-[11px] font-semibold text-red-800">
                  Low attendance
                </span>
              )}
              {atRiskAcademic && (
                <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-900">
                  Low CGPA
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-gray-600">
        <span>
          Batch <span className="font-semibold text-gray-800">{batchId}</span>
        </span>
        <span className="text-gray-300">·</span>
        <span>
          Section{' '}
          <span className="font-semibold text-gray-800">{sectionId ?? '—'}</span>
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-gray-500">CGPA</span>
        <span
          className={`rounded-lg px-2.5 py-1 text-sm font-bold ring-1 ${cgpaBadgeClass(cgpa)}`}
        >
          {cgpaLabel}
        </span>
      </div>
      {footer}
    </>
  );

  const base =
    'relative rounded-xl border border-gray-100 bg-white p-4 text-left shadow-sm transition hover:border-primary/30 hover:shadow-md';

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${base} w-full ${className}`}>
        {inner}
      </button>
    );
  }

  return <div className={`${base} ${className}`}>{inner}</div>;
}
