import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { isAxiosError } from 'axios';
import { z } from 'zod';
import { ArrowLeft, Check, ChevronDown, ChevronUp, Loader2, Lock } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';
import AttendanceToggleRow from '../components/AttendanceToggleRow';
import type { AttendanceToggle } from '../components/attendanceTypes';

/** Matches backend `SessionIn.topic_covered` default when the field is blank. */
const DEFAULT_SESSION_TOPIC_COVERED = 'Regular class session';

const createSessionBodySchema = z.object({
  session_date: z.string().min(1, 'Date is required'),
  start_time: z.string().min(1, 'Start time is required'),
  end_time: z.string().min(1, 'End time is required'),
  session_type: z.enum(['THEORY', 'LAB', 'TUTORIAL']),
  topic_covered: z
    .string()
    .transform((s) => (s.trim() === '' ? DEFAULT_SESSION_TOPIC_COVERED : s.trim())),
});

type CreateSessionBody = z.infer<typeof createSessionBodySchema>;

// ─── types ───────────────────────────────────────────────────────────────────

interface OfferingOut {
  offering_id: number;
  batch_id: number;
  section_id: number | null;
  term_id: number;
  status: string;
}

interface StudentRow {
  student_id: number;
  usn: string;
  full_name?: string | null;
  batch_id: number;
  section_id: number | null;
}

interface SessionOut {
  session_id: number;
  offering_id: number;
  session_date: string;
  start_time: string;
  end_time: string;
  session_type: string;
  topic_covered?: string | null;
  is_locked: boolean;
  total_present: number | null;
}

interface AttendanceRecordRow {
  student_id: number;
  status: string;
  note?: string | null;
}

function isoDate(val: string | Date): string {
  if (typeof val === 'string') return val.slice(0, 10);
  return format(val, 'yyyy-MM-dd');
}

function normalizeTime(t: string): string {
  const s = t.trim();
  if (s.length === 5 && s[2] === ':') return `${s}:00`;
  return s;
}

function timeInputValue(t: string): string {
  return t?.slice(0, 5) ?? '09:00';
}

function sameSlot(sess: SessionOut, date: string, start: string, end: string): boolean {
  return (
    isoDate(sess.session_date) === date &&
    normalizeTime(sess.start_time) === normalizeTime(start) &&
    normalizeTime(sess.end_time) === normalizeTime(end)
  );
}

function normalizeLoadedStatus(s: string): AttendanceToggle {
  if (s === 'PRESENT' || s === 'ABSENT' || s === 'LATE') return s;
  return 'ABSENT';
}

// ─── page ────────────────────────────────────────────────────────────────────

export default function AttendanceMarkPage() {
  const { offeringId: offeringIdParam } = useParams<{ offeringId: string }>();
  const offeringId = offeringIdParam ? Number(offeringIdParam) : NaN;
  const canMark = usePermission('ATTENDANCE_MARK');
  const queryClient = useQueryClient();

  const [sessionId, setSessionId] = useState<number | null>(null);
  const didInitTodayRef = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [errorToastVisible, setErrorToastVisible] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true);

  const [formDate, setFormDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [formStart, setFormStart] = useState('09:00');
  const [formEnd, setFormEnd] = useState('10:00');
  const [formType, setFormType] = useState<'THEORY' | 'LAB' | 'TUTORIAL'>('THEORY');
  const [topicCovered, setTopicCovered] = useState(DEFAULT_SESSION_TOPIC_COVERED);

  const [attendanceMap, setAttendanceMap] = useState<Record<number, AttendanceToggle>>({});
  const mapRef = useRef<Record<number, AttendanceToggle>>({});
  mapRef.current = attendanceMap;

  const offeringQuery = useQuery({
    queryKey: ['academic', 'offerings', 'by-id', offeringId],
    queryFn: async () => {
      const rows = await api.get<OfferingOut[]>('/academic/offerings').then((r) => r.data);
      const o = rows.find((row) => row.offering_id === offeringId);
      if (!o) throw new Error('Offering not found');
      return o;
    },
    enabled: canMark && Number.isFinite(offeringId),
  });

  const offering = offeringQuery.data;

  const studentsQuery = useQuery({
    queryKey: ['students', 'batch', offering?.batch_id, offering?.section_id],
    queryFn: () => {
      const o = offering;
      if (!o) throw new Error('Offering not loaded');
      return api
        .get<StudentRow[]>('/students', {
          params: {
            batch_id: o.batch_id,
            ...(o.section_id != null ? { section_id: o.section_id } : {}),
          },
        })
        .then((r) => r.data);
    },
    enabled: !!offering && canMark,
  });

  const students = studentsQuery.data ?? [];

  const sessionsQuery = useQuery({
    queryKey: ['attendance', 'offerings', offeringId, 'sessions'],
    queryFn: () =>
      api.get<SessionOut[]>(`/attendance/offerings/${offeringId}/sessions`).then((r) => r.data),
    enabled: Number.isFinite(offeringId) && canMark,
  });

  const sessions = sessionsQuery.data ?? [];

  useEffect(() => {
    if (!sessions.length || didInitTodayRef.current) return;
    didInitTodayRef.current = true;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const match = sessions.find((s) => isoDate(s.session_date) === todayStr);
    if (match) setSessionId(match.session_id);
  }, [sessions]);

  const selectedSession = useMemo(
    () => (sessionId != null ? sessions.find((s) => s.session_id === sessionId) ?? null : null),
    [sessionId, sessions],
  );

  const recordsQuery = useQuery({
    queryKey: ['attendance', 'sessions', sessionId, 'records'],
    queryFn: () =>
      api.get<AttendanceRecordRow[]>(`/attendance/sessions/${sessionId}/records`).then((r) => r.data),
    enabled: sessionId != null && canMark,
  });

  const records = recordsQuery.data;

  useEffect(() => {
    setAttendanceMap({});
    setDirty(false);
    setSaveState('idle');
  }, [sessionId]);

  useEffect(() => {
    if (saveState !== 'error' || !saveError) {
      setErrorToastVisible(false);
      return;
    }
    setErrorToastVisible(true);
    const t = window.setTimeout(() => setErrorToastVisible(false), 5000);
    return () => window.clearTimeout(t);
  }, [saveState, saveError]);

  useEffect(() => {
    if (!students.length || sessionId == null || records === undefined) return;
    const next: Record<number, AttendanceToggle> = {};
    for (const st of students) {
      const row = records.find((r) => r.student_id === st.student_id);
      next[st.student_id] = row ? normalizeLoadedStatus(row.status) : 'ABSENT';
    }
    setAttendanceMap(next);
    setDirty(false);
    setSaveState('idle');
  }, [students, sessionId, records]);

  const setStatus = useCallback((studentId: number, status: AttendanceToggle) => {
    setAttendanceMap((prev) => ({ ...prev, [studentId]: status }));
    setDirty(true);
    setSaveState('idle');
    setSaveError(null);
  }, []);

  const markAllPresent = useCallback(() => {
    if (!students.length || selectedSession?.is_locked) return;
    const next: Record<number, AttendanceToggle> = {};
    for (const s of students) next[s.student_id] = 'PRESENT';
    setAttendanceMap(next);
    setDirty(true);
    setSaveState('idle');
  }, [students, selectedSession?.is_locked]);

  const createSessionMutation = useMutation({
    mutationFn: async () => {
      const parsed = createSessionBodySchema.safeParse({
        session_date: formDate,
        start_time: normalizeTime(formStart),
        end_time: normalizeTime(formEnd),
        session_type: formType,
        topic_covered: topicCovered,
      });
      if (!parsed.success) {
        const msg = parsed.error.issues.map((i) => i.message).join('; ') || 'Invalid session';
        throw new Error(msg);
      }
      const body: CreateSessionBody = parsed.data;
      return api.post<SessionOut>(`/attendance/offerings/${offeringId}/sessions`, body).then((r) => r.data);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'offerings', offeringId, 'sessions'] });
      setSessionId(data.session_id);
    },
    onError: async (err) => {
      if (!isAxiosError(err) || err.response?.status !== 409) return;
      const list = await queryClient.fetchQuery({
        queryKey: ['attendance', 'offerings', offeringId, 'sessions'],
        queryFn: () =>
          api.get<SessionOut[]>(`/attendance/offerings/${offeringId}/sessions`).then((r) => r.data),
      });
      const found = list.find((s) => sameSlot(s, formDate, normalizeTime(formStart), normalizeTime(formEnd)));
      if (found) setSessionId(found.session_id);
    },
  });

  const lockMutation = useMutation({
    mutationFn: () => api.patch(`/attendance/sessions/${sessionId}/lock`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance', 'offerings', offeringId, 'sessions'] });
      queryClient.invalidateQueries({ queryKey: ['attendance', 'sessions', sessionId, 'records'] });
      setDirty(false);
    },
  });

  useEffect(() => {
    if (!sessionId || !selectedSession || selectedSession.is_locked || !dirty) return;
    if (!students.length) return;

    const t = window.setTimeout(async () => {
      const snapshot = { ...mapRef.current };
      setSaveState('saving');
      setSaveError(null);
      try {
        const recordsBody = students.map((s) => ({
          student_id: s.student_id,
          status: snapshot[s.student_id] ?? 'ABSENT',
        }));
        await api.put(`/attendance/sessions/${sessionId}/attendance`, { records: recordsBody });
        const after = mapRef.current;
        const unchanged = students.every(
          (s) => (after[s.student_id] ?? 'ABSENT') === (snapshot[s.student_id] ?? 'ABSENT'),
        );
        if (unchanged) {
          setDirty(false);
          setSaveState('saved');
          queryClient.invalidateQueries({ queryKey: ['attendance', 'offerings', offeringId, 'sessions'] });
        } else {
          setSaveState('idle');
        }
      } catch (e) {
        setSaveState('error');
        setSaveError(isAxiosError(e) ? (e.response?.data as { detail?: string })?.detail ?? e.message : 'Save failed');
      }
    }, 2000);

    return () => window.clearTimeout(t);
  }, [attendanceMap, dirty, sessionId, selectedSession, students, offeringId, queryClient]);

  const loadSession = (s: SessionOut) => {
    setSessionId(s.session_id);
    setFormDate(isoDate(s.session_date));
    setFormStart(timeInputValue(s.start_time));
    setFormEnd(timeInputValue(s.end_time));
    setFormType(
      s.session_type === 'LAB' || s.session_type === 'TUTORIAL' || s.session_type === 'THEORY'
        ? (s.session_type as 'THEORY' | 'LAB' | 'TUTORIAL')
        : 'THEORY',
    );
    setTopicCovered(s.topic_covered?.trim() || DEFAULT_SESSION_TOPIC_COVERED);
  };

  if (!canMark) {
    return <Navigate to="/faculty/dashboard" replace />;
  }

  if (!Number.isFinite(offeringId)) {
    return <p className="text-red-600">Invalid offering.</p>;
  }

  if (offeringQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-900 dark:bg-red-950/40">
        Offering not found.
        <Link to="/faculty/dashboard" className="ml-2 text-primary underline">
          Back
        </Link>
      </div>
    );
  }

  const locked = selectedSession?.is_locked ?? false;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {errorToastVisible && saveError && (
        <div
          role="alert"
          className="fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 shadow-lg dark:border-red-900 dark:bg-red-950/95 dark:text-red-100"
        >
          {saveError}
        </div>
      )}
      <Link
        to="/faculty/dashboard"
        className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to dashboard
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mark attendance</h1>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Offering #{offeringId}
            {offering && (
              <>
                {' '}
                · Batch {offering.batch_id}
                {offering.section_id != null && ` · Section ${offering.section_id}`}
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          {saveState === 'saving' && (
            <span className="flex items-center gap-1 text-gray-600 dark:text-gray-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Saving…
            </span>
          )}
          {saveState === 'saved' && !dirty && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Saved
            </span>
          )}
          {selectedSession?.is_locked && (
            <span className="flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-100">
              <Lock className="h-4 w-4" />
              Locked
            </span>
          )}
        </div>
      </header>

      {/* A) Session panel */}
      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">Session</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-400">Date</span>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              disabled={locked}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-400">Type</span>
            <select
              value={formType}
              onChange={(e) => setFormType(e.target.value as 'THEORY' | 'LAB' | 'TUTORIAL')}
              disabled={locked}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            >
              <option value="THEORY">Theory</option>
              <option value="LAB">Lab</option>
              <option value="TUTORIAL">Tutorial</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-400">Start</span>
            <input
              type="time"
              value={formStart}
              onChange={(e) => setFormStart(e.target.value)}
              disabled={locked}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
          <label className="block text-sm">
            <span className="text-gray-600 dark:text-gray-400">End</span>
            <input
              type="time"
              value={formEnd}
              onChange={(e) => setFormEnd(e.target.value)}
              disabled={locked}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            />
          </label>
        </div>
        <label className="mt-4 block text-sm">
          <span className="text-gray-600 dark:text-gray-400">
            Topic covered <span className="text-red-600 dark:text-red-400">*</span>
          </span>
          <input
            type="text"
            value={topicCovered}
            onChange={(e) => setTopicCovered(e.target.value)}
            disabled={locked}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800"
            placeholder={DEFAULT_SESSION_TOPIC_COVERED}
            required
            aria-required
          />
          <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
            If left blank, &quot;{DEFAULT_SESSION_TOPIC_COVERED}&quot; is sent when you start the session.
          </span>
        </label>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={locked || createSessionMutation.isPending}
            onClick={() => createSessionMutation.mutate()}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {createSessionMutation.isPending ? 'Starting…' : 'Start session'}
          </button>
          {sessionId != null && (
            <button
              type="button"
              disabled={locked || lockMutation.isPending}
              onClick={() => {
                if (
                  !window.confirm(
                    'Lock this session? Attendance can no longer be edited.',
                  )
                )
                  return;
                lockMutation.mutate();
              }}
              className="inline-flex items-center gap-2 rounded-lg border-2 border-red-600 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 dark:bg-gray-900 dark:hover:bg-red-950/40"
            >
              <Lock className="h-4 w-4 shrink-0" />
              {lockMutation.isPending ? 'Locking…' : 'Lock session'}
            </button>
          )}
        </div>
        {createSessionMutation.isError &&
          (!isAxiosError(createSessionMutation.error) ||
            createSessionMutation.error.response?.status !== 409) && (
            <p className="mt-2 text-sm text-red-600">
              {createSessionMutation.error instanceof Error
                ? createSessionMutation.error.message
                : 'Could not create session.'}
            </p>
          )}
      </section>

      {/* B) Grid */}
      <section className="rounded-xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-4 py-3 dark:border-gray-800">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance</h2>
          {sessionId != null && !locked && (
            <button
              type="button"
              onClick={markAllPresent}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800"
            >
              Mark all present
            </button>
          )}
        </div>
        {studentsQuery.isLoading || (sessionId != null && recordsQuery.isLoading) ? (
          <div className="animate-pulse p-8 text-center text-gray-500">Loading…</div>
        ) : sessionId == null ? (
          <p className="p-8 text-center text-gray-500">
            Start a session above, or pick one from history — today&apos;s session loads automatically when it exists.
          </p>
        ) : students.length === 0 ? (
          <p className="p-8 text-center text-gray-500">No students found for this batch/section.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 text-left text-xs font-semibold uppercase text-gray-600 dark:bg-gray-800/80 dark:text-gray-400">
                  <th className="px-3 py-2">USN</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {students
                  .slice()
                  .sort((a, b) => a.usn.localeCompare(b.usn))
                  .map((s) => (
                    <AttendanceToggleRow
                      key={s.student_id}
                      usn={s.usn}
                      name={s.full_name?.trim() || '—'}
                      status={attendanceMap[s.student_id] ?? 'ABSENT'}
                      disabled={locked}
                      onChange={(st) => setStatus(s.student_id, st)}
                    />
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* E) History */}
      <section className="rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
        <button
          type="button"
          onClick={() => setHistoryOpen((o) => !o)}
          className="flex w-full items-center justify-between px-4 py-3 text-left font-semibold text-gray-900 dark:text-white"
        >
          Session history
          {historyOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </button>
        {historyOpen && (
          <div className="overflow-x-auto border-t border-gray-100 dark:border-gray-800">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 dark:bg-gray-800/80">
                <tr>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Present</th>
                  <th className="px-4 py-2 text-left">Locked</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr
                    key={s.session_id}
                    className={`cursor-pointer border-t border-gray-100 hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50 ${
                      sessionId === s.session_id ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => loadSession(s)}
                  >
                    <td className="px-4 py-2">{isoDate(s.session_date)}</td>
                    <td className="px-4 py-2">{s.session_type}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{s.total_present ?? '—'}</td>
                    <td className="px-4 py-2">{s.is_locked ? 'Yes' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sessions.length === 0 && (
              <p className="p-4 text-center text-gray-500">No sessions yet.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
