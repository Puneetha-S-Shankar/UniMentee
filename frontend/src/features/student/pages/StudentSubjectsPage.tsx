import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, BookOpen } from 'lucide-react';
import api from '../../../services/api';
import { useRole } from '../../../hooks/usePermission';

interface StudentMe {
  student_id: number;
  batch_id: number;
  section_id: number | null;
}

interface EnrollmentOut {
  enrollment_id: number;
  offering_id: number;
  student_id: number;
  status: string;
}

interface OfferingOut {
  offering_id: number;
  curriculum_id: number;
  batch_id: number;
  section_id: number | null;
  academic_year_id: number;
  term_id: number;
  status: string;
  current_enrollment: number;
  max_enrollment: number | null;
  version: number;
}

interface SubjectOut {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  credits: number;
  subject_type: string;
  theory_hours: number | null;
  lab_hours: number | null;
  is_active: boolean;
}

interface TermOut {
  term_id: number;
  name: string;
  academic_year_id: number;
  is_current: boolean;
}

interface AttendanceSummaryRow {
  offering_id: number;
  subject_code: string;
  subject_name: string;
  total_sessions: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
}

interface AssessmentRow {
  assessment_id: number;
  title: string | null;
  max_marks: number;
  status: string;
}

interface EnrichedSubjectCard {
  offering: OfferingOut;
  subject: SubjectOut | null;
}

function offeringStatusBadgeClass(status: string): string {
  switch (status) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'LOCKED':
      return 'bg-gray-200 text-gray-800 border-gray-300';
    case 'ARCHIVED':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function subjectTypeBadgeClass(t: string): string {
  switch (t) {
    case 'THEORY':
      return 'bg-indigo-100 text-indigo-900 border-indigo-200';
    case 'LAB':
      return 'bg-orange-100 text-orange-900 border-orange-200';
    case 'THEORY_LAB':
      return 'bg-violet-100 text-violet-900 border-violet-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

function attendancePctClass(pct: number): string {
  if (pct >= 75) return 'bg-emerald-50 text-emerald-900 border-emerald-200';
  if (pct >= 65) return 'bg-amber-50 text-amber-900 border-amber-200';
  return 'bg-red-50 text-red-900 border-red-200';
}

function SubjectDetailModal({
  open,
  card,
  onClose,
}: {
  open: boolean;
  card: EnrichedSubjectCard | null;
  onClose: () => void;
}) {
  const offeringId = card?.offering.offering_id ?? null;

  const { data: assessments = [], isLoading: assLoading } = useQuery<AssessmentRow[]>({
    queryKey: ['offering-assessments', offeringId],
    queryFn: () =>
      api.get(`/marks/offerings/${offeringId}/assessments`).then(r => {
        const raw = r.data as Record<string, unknown>[];
        return Array.isArray(raw)
          ? raw.map(a => ({
              assessment_id: Number(a.assessment_id),
              title: (a.title as string) ?? null,
              max_marks: Number(a.max_marks ?? 0),
              status: String(a.status ?? ''),
            }))
          : [];
      }),
    enabled: open && offeringId != null,
    staleTime: 60_000,
  });

  if (!open || !card) return null;

  const { offering, subject } = card;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-start justify-between border-b border-gray-100 bg-white px-5 py-4">
          <div>
            <p className="font-mono text-xs font-bold text-primary">{subject?.subject_code ?? '—'}</p>
            <h2 className="text-lg font-extrabold text-gray-900">{subject?.subject_name ?? 'Subject'}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-5 py-4 text-sm">
          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Credits & hours</h3>
            <ul className="space-y-1 text-gray-800">
              <li>
                <span className="text-gray-500">Credits:</span>{' '}
                <span className="font-semibold">{subject?.credits ?? '—'}</span>
              </li>
              <li>
                <span className="text-gray-500">Theory hours/week:</span>{' '}
                {subject?.theory_hours ?? '—'}
              </li>
              <li>
                <span className="text-gray-500">Lab hours/week:</span> {subject?.lab_hours ?? '—'}
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Offering</h3>
            <ul className="space-y-1 text-gray-800">
              <li>
                <span className="text-gray-500">Batch ID:</span> {offering.batch_id}
              </li>
              <li>
                <span className="text-gray-500">Section ID:</span> {offering.section_id ?? '—'}
              </li>
              <li>
                <span className="text-gray-500">Term ID:</span> {offering.term_id}
              </li>
              <li>
                <span className="text-gray-500">Academic year ID:</span> {offering.academic_year_id}
              </li>
              <li>
                <span className="text-gray-500">Status:</span>{' '}
                <span
                  className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${offeringStatusBadgeClass(offering.status)}`}
                >
                  {offering.status}
                </span>
              </li>
              <li>
                <span className="text-gray-500">Enrollment:</span>{' '}
                {offering.current_enrollment}
                {offering.max_enrollment != null ? ` / ${offering.max_enrollment} max` : ''}
              </li>
            </ul>
            <p className="mt-2 text-xs italic text-gray-500">
              Faculty: Faculty TBD (course_lead not exposed on offerings API yet).
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">Assessment plan</h3>
            {assLoading ? (
              <p className="text-gray-400">Loading assessments…</p>
            ) : assessments.length === 0 ? (
              <p className="text-gray-500">No assessments listed for this offering.</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100">
                {assessments.map(a => (
                  <li key={a.assessment_id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                    <span className="font-medium text-gray-900">{a.title || `Assessment #${a.assessment_id}`}</span>
                    <span className="text-xs text-gray-600">
                      Max {a.max_marks} ·{' '}
                      <span className="font-semibold text-gray-800">{a.status}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SubjectCard({
  card,
  attendancePct,
  showAttendance,
  onOpen,
}: {
  card: EnrichedSubjectCard;
  attendancePct: number | null;
  showAttendance: boolean;
  onOpen: () => void;
}) {
  const { offering, subject } = card;

  return (
    <div className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-sm font-extrabold text-gray-900">{subject?.subject_code ?? '—'}</p>
          <p className="mt-0.5 text-base font-bold leading-snug text-gray-900">
            {subject?.subject_name ?? 'Unknown subject'}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${offeringStatusBadgeClass(offering.status)}`}
        >
          {offering.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <span className="inline-flex rounded-md bg-gray-100 px-2 py-1 text-xs font-bold text-gray-800">
          {subject?.credits ?? '—'} cr
        </span>
        <span
          className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${subjectTypeBadgeClass(subject?.subject_type ?? 'THEORY')}`}
        >
          {subject?.subject_type ?? '—'}
        </span>
        {showAttendance && attendancePct != null && (
          <span
            className={`inline-flex rounded-md border px-2 py-1 text-xs font-bold ${attendancePctClass(attendancePct)}`}
            title="Attendance % (current term)"
          >
            Attendance {attendancePct.toFixed(1)}%
          </span>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Enrolled: <span className="font-semibold text-gray-800">{offering.current_enrollment}</span> students
      </p>
      <p className="mt-1 text-xs italic text-gray-400">Faculty: Faculty TBD</p>

      <button
        type="button"
        onClick={onOpen}
        className="mt-4 w-full rounded-lg border border-gray-200 bg-gray-50 py-2 text-sm font-bold text-gray-800 hover:bg-gray-100"
      >
        View details
      </button>
    </div>
  );
}

export default function StudentSubjectsPage() {
  const role = useRole();
  const isStudent = role === 'STUDENT';
  const [modalCard, setModalCard] = useState<EnrichedSubjectCard | null>(null);

  const { data: me, isLoading: meLoading } = useQuery<StudentMe>({
    queryKey: ['student-me'],
    queryFn: () => api.get('/students/me').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: isStudent,
  });

  const studentId = me?.student_id;

  const { data: enrollments = [], isLoading: enLoading } = useQuery<EnrollmentOut[]>({
    queryKey: ['student-enrollments', studentId],
    queryFn: () => api.get(`/students/${studentId}/enrollments`).then(r => r.data),
    staleTime: 60_000,
    enabled: isStudent && studentId != null,
  });

  const batchId = me?.batch_id;
  const sectionId = me?.section_id;

  const { data: offerings = [], isLoading: offLoading } = useQuery<OfferingOut[]>({
    queryKey: ['academic-offerings', batchId, sectionId],
    queryFn: () =>
      api
        .get('/academic/offerings', {
          params: {
            ...(batchId != null ? { batch_id: batchId } : {}),
            ...(sectionId != null ? { section_id: sectionId } : {}),
          },
        })
        .then(r => r.data),
    staleTime: 60_000,
    enabled: isStudent && batchId != null,
  });

  const { data: subjects = [], isLoading: subLoading } = useQuery<SubjectOut[]>({
    queryKey: ['academic-subjects'],
    queryFn: () => api.get('/academic/subjects').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: isStudent,
  });

  const { data: terms = [], isLoading: termsLoading } = useQuery<TermOut[]>({
    queryKey: ['academic-terms'],
    queryFn: () => api.get('/academic/terms').then(r => r.data),
    staleTime: 60_000,
    enabled: isStudent,
  });

  const { data: attendanceRows = [], isLoading: attLoading } = useQuery<AttendanceSummaryRow[]>({
    queryKey: ['student-attendance-summary'],
    queryFn: () => api.get('/students/me/attendance-summary').then(r => r.data),
    staleTime: 60_000,
    enabled: isStudent,
  });

  const currentTermId = useMemo(() => terms.find(t => t.is_current)?.term_id ?? null, [terms]);

  const attendanceByOffering = useMemo(() => {
    const m = new Map<number, number>();
    for (const row of attendanceRows) {
      m.set(row.offering_id, row.percentage);
    }
    return m;
  }, [attendanceRows]);

  const cards = useMemo((): EnrichedSubjectCard[] => {
    const enrolledIds = new Set(enrollments.map(e => e.offering_id));
    const byCurriculum = new Map(subjects.map(s => [s.subject_id, s]));

    return offerings
      .filter(o => enrolledIds.has(o.offering_id))
      .map(o => ({
        offering: o,
        subject: byCurriculum.get(o.curriculum_id) ?? null,
      }));
  }, [enrollments, offerings, subjects]);

  /** Latest term among this student's enrolled offerings (fallback when API has no is_current). */
  const latestEnrolledTermId = useMemo(
    () => (cards.length ? Math.max(...cards.map(c => c.offering.term_id)) : null),
    [cards],
  );

  const attendanceTermId = currentTermId ?? latestEnrolledTermId;

  const groupedByTerm = useMemo(() => {
    const map = new Map<number, EnrichedSubjectCard[]>();
    for (const c of cards) {
      const tid = c.offering.term_id;
      if (!map.has(tid)) map.set(tid, []);
      map.get(tid)!.push(c);
    }
    const termIds = [...map.keys()].sort((a, b) => {
      if (currentTermId != null) {
        if (a === currentTermId) return -1;
        if (b === currentTermId) return 1;
      }
      return b - a;
    });
    return { map, termIds };
  }, [cards, currentTermId]);

  const loading = meLoading || enLoading || offLoading || subLoading || termsLoading || attLoading;

  if (!isStudent) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm font-medium text-amber-900">
        This page is for student accounts. Switch to a student profile or contact your administrator.
      </div>
    );
  }

  return (
    <div className="w-full min-w-0 space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">My subjects</h1>
        <p className="mt-1 text-sm text-gray-500">
          Current and previous term enrollments. Attendance % applies to your <strong>current term</strong> only.
        </p>
      </div>

      {loading ? (
        <div className="grid animate-pulse grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-48 rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : enrollments.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-16 text-center">
          <BookOpen className="mb-3 h-12 w-12 text-gray-300" />
          <p className="text-base font-semibold text-gray-800">No subjects enrolled</p>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            You are not enrolled in any subject offerings yet. Contact your administrator to update enrollments.
          </p>
          <a
            href="mailto:admin@university.edu"
            className="mt-4 text-sm font-bold text-primary underline hover:text-primary/80"
          >
            Contact administrator
          </a>
        </div>
      ) : cards.length === 0 ? (
        <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm text-amber-900">
          <p className="font-semibold">No matching offerings found</p>
          <p className="mt-1 text-amber-800/90">
            You have enrollments, but offerings could not be matched to your batch/section filter. Try refreshing or
            contact{' '}
            <a href="mailto:admin@university.edu" className="font-bold underline">
              admin
            </a>
            .
          </p>
        </div>
      ) : (
        groupedByTerm.termIds.map(tid => {
          const list = groupedByTerm.map.get(tid) ?? [];
          const isCurrent =
            (currentTermId != null && tid === currentTermId) ||
            (currentTermId == null && latestEnrolledTermId != null && tid === latestEnrolledTermId);
          const termLabel = terms.find(t => t.term_id === tid)?.name ?? `Term ${tid}`;

          return (
            <section key={tid} className="space-y-4">
              <h2 className="text-lg font-bold text-gray-900">
                {isCurrent ? 'Current term' : 'Previous term'}
                <span className="ml-2 font-mono text-sm font-semibold text-gray-500">· {termLabel}</span>
              </h2>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {list.map(card => {
                  const showAtt =
                    attendanceTermId != null && card.offering.term_id === attendanceTermId;
                  return (
                    <SubjectCard
                      key={card.offering.offering_id}
                      card={card}
                      showAttendance={showAtt}
                      attendancePct={showAtt ? attendanceByOffering.get(card.offering.offering_id) ?? null : null}
                      onOpen={() => setModalCard(card)}
                    />
                  );
                })}
              </div>
            </section>
          );
        })
      )}

      <SubjectDetailModal open={!!modalCard} card={modalCard} onClose={() => setModalCard(null)} />
    </div>
  );
}
