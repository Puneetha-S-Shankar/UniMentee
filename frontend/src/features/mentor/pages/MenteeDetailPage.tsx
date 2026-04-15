import { useMemo, useState, useEffect } from 'react';
import { useNavigate, useParams, Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, AlertTriangle } from 'lucide-react';
import api from '../../../services/api';
import { useAllPermissions } from '../../../hooks/usePermission';
import { cgpaBadgeClass } from '../../../components/shared/StudentCard';
import { MenteeOverviewTab } from '../components/mentee/MenteeOverviewTab';
import { MenteeAttendanceTab } from '../components/mentee/MenteeAttendanceTab';
import { MenteeMarksTab, buildOfferingLabelMap } from '../components/mentee/MenteeMarksTab';
import { MenteeSessionsTab } from '../components/mentee/MenteeSessionsTab';
import { MenteePortfolioTab } from '../components/mentee/MenteePortfolioTab';
import { MenteeLeaveTab } from '../components/mentee/MenteeLeaveTab';
import type {
  StudentDetail,
  MenteeListRow,
  AttendanceSummary,
  OfferingMarks,
  AcademicTerm,
  AcademicSummary,
  MentorSessionRow,
  AssignmentRow,
  SubjectOut,
  OfferingOut,
} from '../components/mentee/types';

type TabId = 'overview' | 'attendance' | 'marks' | 'sessions' | 'portfolio' | 'leave';

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function academicStanding(cgpa: number | null) {
  if (cgpa == null)
    return { label: 'No CGPA data', className: 'border-gray-200 bg-gray-50 text-gray-600' };
  if (cgpa >= 7.5)
    return { label: 'Good standing', className: 'border-emerald-200 bg-emerald-50 text-emerald-800' };
  if (cgpa >= 5.5)
    return { label: 'Warning', className: 'border-amber-200 bg-amber-50 text-amber-900' };
  return { label: 'Probation', className: 'border-red-200 bg-red-50 text-red-800' };
}

function avgPct(rows: AttendanceSummary[]) {
  if (!rows.length) return null;
  const s = rows.reduce((a, b) => a + b.percentage, 0);
  return Math.round((s / rows.length) * 100) / 100;
}

const TAB_IDS: TabId[] = ['overview', 'attendance', 'marks', 'sessions', 'portfolio', 'leave'];

export default function MenteeDetailPage() {
  const { studentId: studentIdParam } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const studentId = Number(studentIdParam);
  const canAccess = useAllPermissions(['STUDENT_VIEW', 'MARKS_VIEW_ALL']);

  const [tab, setTab] = useState<TabId>('overview');
  const [termId, setTermId] = useState<number | null>(null);

  useEffect(() => {
    const t = searchParams.get('tab');
    if (t && TAB_IDS.includes(t as TabId)) {
      setTab(t as TabId);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete('tab');
          return next;
        },
        { replace: true }
      );
    }
  }, [searchParams, setSearchParams]);

  const { data: student, isLoading: stLoading, error: stError } = useQuery<StudentDetail>({
    queryKey: ['student-detail', studentId],
    queryFn: () => api.get(`/students/${studentId}`).then((r) => r.data),
    enabled: canAccess && Number.isFinite(studentId),
  });

  const { data: mentees = [], isLoading: menteesLoading } = useQuery<MenteeListRow[]>({
    queryKey: ['mentor-mentees-detail', studentId],
    queryFn: () => api.get('/mentor/mentees').then((r) => r.data),
    enabled: canAccess && Number.isFinite(studentId),
  });

  const menteeRow = useMemo(
    () => mentees.find((m) => m.student.student_id === studentId),
    [mentees, studentId]
  );

  const { data: attendance = [], isLoading: attLoading } = useQuery<AttendanceSummary[]>({
    queryKey: ['mentor-mentee-attendance', studentId],
    queryFn: () => api.get(`/mentor/mentees/${studentId}/attendance`).then((r) => r.data),
    enabled: canAccess && !!menteeRow,
  });

  const { data: terms = [], isLoading: termsLoading } = useQuery<AcademicTerm[]>({
    queryKey: ['academic-terms-mentee', studentId],
    queryFn: () => api.get('/academic/terms').then((r) => r.data),
    staleTime: 5 * 60_000,
    enabled: canAccess && !!menteeRow,
  });

  const {
    data: academicSummary,
    isLoading: academicSummaryLoading,
    isError: academicSummaryError,
  } = useQuery<AcademicSummary>({
    queryKey: ['student-academic-summary', studentId],
    queryFn: () => api.get(`/students/${studentId}/academic-summary`).then((r) => r.data),
    enabled: canAccess && !!menteeRow,
  });

  useEffect(() => {
    if (academicSummary == null) return;
    if (import.meta.env.DEV) {
      // eslint-disable-next-line no-console
      console.debug('[MenteeDetailPage] academic-summary response', academicSummary);
    }
  }, [academicSummary]);

  const { data: assignments = [] } = useQuery<AssignmentRow[]>({
    queryKey: ['mentor-assignments-detail', studentId],
    queryFn: () => api.get('/mentor/assignments').then((r) => r.data),
    enabled: canAccess && !!menteeRow,
  });

  const assignment = useMemo(
    () => assignments.find((a) => a.student_id === studentId) ?? null,
    [assignments, studentId]
  );

  const { data: sessions = [] } = useQuery<MentorSessionRow[]>({
    queryKey: ['mentor-assignment-sessions', assignment?.assignment_id],
    queryFn: () =>
      api
        .get(`/mentor/assignments/${assignment!.assignment_id}/sessions`)
        .then((r) => r.data),
    enabled: canAccess && !!assignment,
  });

  const { data: subjects = [] } = useQuery<SubjectOut[]>({
    queryKey: ['academic-subjects'],
    queryFn: () => api.get('/academic/subjects').then((r) => r.data),
    enabled: canAccess && !!student && tab === 'marks',
  });

  const { data: offerings = [] } = useQuery<OfferingOut[]>({
    queryKey: ['academic-offerings-mentee', student?.batch_id],
    queryFn: () =>
      api
        .get('/academic/offerings', { params: { batch_id: student!.batch_id } })
        .then((r) => r.data),
    enabled: canAccess && !!student && tab === 'marks',
  });

  const offeringLabel = useMemo(
    () => buildOfferingLabelMap(offerings, subjects),
    [offerings, subjects]
  );

  const { data: gradeScales = [] } = useQuery({
    queryKey: ['grade-scales-mentee'],
    queryFn: () => api.get('/academic/grade-scales').then((r) => r.data),
    enabled: canAccess && tab === 'marks',
  });

  const { data: marks = [], isLoading: marksLoading } = useQuery<OfferingMarks[]>({
    queryKey: ['mentor-mentee-marks', studentId, termId],
    queryFn: () =>
      api
        .get(`/mentor/mentees/${studentId}/marks`, { params: { term_id: termId } })
        .then((r) => r.data),
    enabled: canAccess && !!menteeRow && termId != null && tab === 'marks',
  });

  useEffect(() => {
    if (termId != null) return;
    const cur = terms.find((t) => t.is_current);
    if (cur) {
      setTermId(cur.term_id);
      return;
    }
    if (terms.length) setTermId(terms[0].term_id);
  }, [terms, termId]);

  const displayCgpa =
    academicSummary?.cgpa != null ? academicSummary.cgpa : (student?.cgpa ?? null);
  const standing = academicStanding(displayCgpa);
  const attAvg = avgPct(attendance);

  if (!canAccess) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm text-amber-900">
        You need <strong>STUDENT_VIEW</strong> and <strong>MARKS_VIEW_ALL</strong> to open mentee
        profiles.
      </div>
    );
  }

  if (!Number.isFinite(studentId)) {
    return <p className="text-sm text-red-600">Invalid student.</p>;
  }

  if (stLoading || menteesLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-100" />
        <div className="h-40 animate-pulse rounded-2xl bg-gray-100" />
      </div>
    );
  }

  if (stError || !student) {
    return <p className="text-sm text-red-600">Student not found.</p>;
  }

  if (!menteeRow) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800">
        This student is not assigned to you as a mentee, or the assignment is inactive.
        <div className="mt-4">
          <Link to="/mentor/mentees" className="font-semibold text-primary underline">
            Back to mentees
          </Link>
        </div>
      </div>
    );
  }

  const tabs: { id: TabId; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'attendance', label: 'Attendance' },
    { id: 'marks', label: 'Marks' },
    { id: 'sessions', label: 'Sessions' },
    { id: 'portfolio', label: 'Portfolio' },
    { id: 'leave', label: 'Leave' },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <button
        type="button"
        onClick={() => navigate('/mentor/mentees')}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to mentees
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
          <div className="flex gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-bold text-primary">
              {initials(student.user.full_name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{student.user.full_name}</h1>
              <p className="font-mono text-sm text-gray-500">{student.usn}</p>
              <p className="mt-1 text-sm text-gray-600">
                Batch {student.batch_id}
                {student.section_id != null ? ` · Section ${student.section_id}` : ''}
              </p>
            </div>
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-3 lg:justify-end">
            <span
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ring-1 ${cgpaBadgeClass(displayCgpa)}`}
            >
              CGPA{' '}
              {academicSummaryLoading
                ? '…'
                : displayCgpa != null
                  ? displayCgpa.toFixed(2)
                  : '—'}
            </span>
            <span className="rounded-full border px-3 py-1 text-xs font-bold text-gray-700">
              Attendance avg: {attAvg != null ? `${attAvg}%` : attLoading ? '…' : '—'}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold ${standing.className}`}
            >
              {academicSummaryError ? 'Academic data unavailable' : standing.label}
            </span>
            {(menteeRow.at_risk.attendance || menteeRow.at_risk.academic) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-bold text-red-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                At risk
                {menteeRow.at_risk.attendance && ' · Attendance'}
                {menteeRow.at_risk.academic && ' · Academic'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-px">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? 'border border-b-0 border-gray-200 bg-white text-primary'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-[320px]">
        {tab === 'overview' && (
          <MenteeOverviewTab
            academicSummary={academicSummary}
            academicLoading={academicSummaryLoading}
            attendanceSummaries={attendance}
            sessions={sessions}
          />
        )}
        {tab === 'attendance' && (attLoading ? <p className="text-sm text-gray-400">Loading…</p> : <MenteeAttendanceTab rows={attendance} />)}
        {tab === 'marks' && (
          <MenteeMarksTab
            terms={terms}
            termsLoading={termsLoading}
            selectedTermId={termId}
            onTermChange={setTermId}
            marks={marks}
            marksLoading={marksLoading}
            gradeScales={gradeScales}
            offeringLabel={offeringLabel}
          />
        )}
        {tab === 'sessions' && (
          <MenteeSessionsTab
            sessions={sessions}
            studentId={studentId}
            assignmentId={assignment?.assignment_id ?? null}
          />
        )}
        {tab === 'portfolio' && <MenteePortfolioTab />}
        {tab === 'leave' && <MenteeLeaveTab />}
      </div>
    </div>
  );
}
