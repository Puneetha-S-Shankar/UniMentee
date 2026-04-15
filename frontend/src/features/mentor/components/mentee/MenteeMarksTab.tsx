import { Fragment, useCallback, useEffect, useState } from 'react';
import type { AcademicTerm, OfferingMarks, SubjectOut, OfferingOut } from './types';

interface GradeScaleRow {
  grade: string;
  grade_point: number;
  min_percentage: number;
  max_percentage: number;
  is_passing: boolean;
}

function gradeLetterForPercentage(pct: number | null | undefined, scales: GradeScaleRow[]): string {
  if (pct == null || Number.isNaN(pct)) return '—';
  const row = scales.find((s) => pct >= s.min_percentage && pct <= s.max_percentage);
  return row?.grade ?? '—';
}

function pctColorClass(pct: number | null | undefined): string {
  if (pct == null || Number.isNaN(pct)) return 'text-gray-400';
  if (pct >= 60) return 'text-emerald-700 font-semibold';
  if (pct >= 40) return 'text-amber-600 font-semibold';
  return 'text-red-600 font-semibold';
}

function subjectKey(offeringId: number, label: string) {
  return `${offeringId}\u0000${label}`;
}

export function MenteeMarksTab({
  terms,
  termsLoading,
  selectedTermId,
  onTermChange,
  marks,
  marksLoading,
  gradeScales,
  offeringLabel,
}: {
  terms: AcademicTerm[];
  termsLoading: boolean;
  selectedTermId: number | null;
  onTermChange: (id: number) => void;
  marks: OfferingMarks[];
  marksLoading: boolean;
  gradeScales: GradeScaleRow[];
  offeringLabel: (offeringId: number) => string;
}) {
  const [open, setOpen] = useState<Set<string>>(new Set());
  const toggle = useCallback((key: string) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (marks.length && open.size === 0) {
      const first = marks[0];
      setOpen(new Set([subjectKey(first.offering_id, offeringLabel(first.offering_id))]));
    }
  }, [marks, offeringLabel, open.size]);

  return (
    <div className="space-y-4">
      <label className="flex max-w-xs flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">Term</span>
        <select
          className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
          value={selectedTermId ?? ''}
          disabled={termsLoading || !terms.length}
          onChange={(e) => onTermChange(Number(e.target.value))}
        >
          {!terms.length ? (
            <option value="">No terms</option>
          ) : (
            terms.map((t) => (
              <option key={t.term_id} value={t.term_id}>
                {t.name}
                {t.is_current ? ' (current)' : ''}
              </option>
            ))
          )}
        </select>
      </label>

      {marksLoading && <p className="text-sm text-gray-400">Loading marks…</p>}

      <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-base font-extrabold text-gray-900">Subject marks</h3>
        {!marks.length && !marksLoading ? (
          <p className="text-sm text-gray-400">No assessments for this term</p>
        ) : (
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wider text-gray-500">
                <th className="pb-2 pr-2">Assessment</th>
                <th className="pb-2 pr-2">Max</th>
                <th className="pb-2 pr-2">Obtained</th>
                <th className="pb-2 pr-2">%</th>
                <th className="pb-2 pr-2">Status</th>
                <th className="pb-2">Grade</th>
              </tr>
            </thead>
            <tbody>
              {marks.map((om) => {
                const label = om.subject_name?.trim() || offeringLabel(om.offering_id);
                const sk = subjectKey(om.offering_id, label);
                const expanded = open.has(sk);
                return (
                  <Fragment key={sk}>
                    <tr
                      className="cursor-pointer bg-gray-100/90 hover:bg-gray-100"
                      onClick={() => toggle(sk)}
                    >
                      <td colSpan={6} className="px-3 py-2.5 font-bold text-gray-900">
                        {label}{' '}
                        <span className="font-mono text-xs font-semibold text-gray-500">
                          (offering {om.offering_id})
                        </span>
                      </td>
                    </tr>
                    {expanded &&
                      om.assessments.map((a) => {
                        const published = a.status === 'PUBLISHED';
                        return (
                          <tr key={a.assessment_id} className="border-b border-gray-100 bg-white">
                            <td className="py-2.5 pr-2 pl-4 text-gray-800">{a.title}</td>
                            <td className="py-2.5 pr-2">{a.max_marks}</td>
                            <td className="py-2.5 pr-2">
                              {!published ? (
                                <span className="italic text-gray-400">—</span>
                              ) : a.is_absent ? (
                                <span className="text-gray-500">Absent</span>
                              ) : (
                                (a.marks_obtained ?? '—')
                              )}
                            </td>
                            <td className={`py-2.5 pr-2 ${pctColorClass(published ? a.percentage : null)}`}>
                              {!published ? (
                                <span className="italic text-gray-400">{a.status}</span>
                              ) : a.percentage != null ? (
                                `${a.percentage.toFixed(1)}%`
                              ) : (
                                '—'
                              )}
                            </td>
                            <td className="py-2.5 pr-2 text-xs text-gray-600">{a.status}</td>
                            <td className="py-2.5 font-medium text-gray-800">
                              {!published ? (
                                '—'
                              ) : (
                                gradeLetterForPercentage(a.percentage, gradeScales)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
        <h3 className="mb-3 text-sm font-extrabold text-gray-900">Grade scale</h3>
        {gradeScales.length === 0 ? (
          <p className="text-xs text-gray-400">No grade scale data</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[220px] border-collapse text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-left text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  <th className="pb-2 pr-2">Grade</th>
                  <th className="pb-2 pr-2">Range</th>
                  <th className="pb-2 text-right">Points</th>
                </tr>
              </thead>
              <tbody className="text-gray-800">
                {gradeScales.map((s) => (
                  <tr key={`${s.grade}-${s.min_percentage}`} className="border-b border-gray-50 last:border-0">
                    <td className="py-1.5 pr-2 font-bold">{s.grade}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-gray-600">
                      {s.min_percentage}%–{s.max_percentage}%
                    </td>
                    <td className="py-1.5 text-right tabular-nums font-medium">{s.grade_point}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/** Build offering_id -> display label from offerings + subjects */
export function buildOfferingLabelMap(
  offerings: OfferingOut[],
  subjects: SubjectOut[]
): (offeringId: number) => string {
  const subByCur = new Map(subjects.map((s) => [s.subject_id, s]));
  const byOffering = new Map<number, string>();
  for (const o of offerings) {
    const sub = subByCur.get(o.curriculum_id);
    byOffering.set(
      o.offering_id,
      sub ? `${sub.subject_name} (${sub.subject_code})` : `Offering ${o.offering_id}`
    );
  }
  return (offeringId: number) => byOffering.get(offeringId) ?? `Offering ${offeringId}`;
}
