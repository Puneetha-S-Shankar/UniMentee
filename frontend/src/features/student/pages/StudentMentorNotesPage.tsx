import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Users } from 'lucide-react';
import api from '../../../services/api';

interface MentorInfo {
  assignment_id: number | null;
  mentor_user_id: number | null;
  mentor_name: string | null;
  mentor_email: string | null;
}

interface MentoringSession {
  session_id: number;
  assignment_id: number;
  session_date: string;
  session_time: string | null;
  duration_minutes: number | null;
  session_type: string;
  topics_discussed: string | null;
  action_items: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  career_notes: string | null;
  created_by: number;
}

const TOPICS_PREVIEW = 100;

function sessionTypeBadgeClass(t: string): string {
  const u = t.toUpperCase();
  switch (u) {
    case 'ACADEMIC':
      return 'bg-blue-100 text-blue-900 border-blue-200';
    case 'PERSONAL':
      return 'bg-pink-100 text-pink-900 border-pink-200';
    case 'CAREER':
      return 'bg-violet-100 text-violet-900 border-violet-200';
    case 'DISCIPLINARY':
      return 'bg-orange-100 text-orange-900 border-orange-200';
    case 'GENERAL':
      return 'bg-teal-100 text-teal-900 border-teal-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

function formatSessionWhen(sessionDate: string, sessionTime: string | null): string {
  const base = new Date(sessionDate + 'T12:00:00');
  if (sessionTime) {
    const parts = sessionTime.split(':');
    const h = parseInt(parts[0] ?? '0', 10);
    const m = parseInt(parts[1] ?? '0', 10);
    const s = parseInt(parts[2] ?? '0', 10);
    base.setHours(h, m, s, 0);
  }
  return base.toLocaleString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatFollowUpDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function TopicsBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const needsMore = text.length > TOPICS_PREVIEW;
  const shown = open || !needsMore ? text : text.slice(0, TOPICS_PREVIEW).trim() + '…';

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Topics discussed</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-800">{shown}</p>
      {needsMore && (
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="mt-1 text-xs font-bold text-primary hover:underline"
        >
          {open ? 'Show less' : 'Read more'}
        </button>
      )}
    </div>
  );
}

function CareerNotesBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-gray-100 bg-gray-50/80 p-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between text-left text-xs font-bold uppercase tracking-wider text-gray-600"
      >
        Career notes
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </button>
      {open && <p className="mt-2 whitespace-pre-wrap text-sm text-gray-800">{text}</p>}
    </div>
  );
}

export default function StudentMentorNotesPage() {
  const { data: mentorInfo, isLoading: mentorLoading, error: mentorError } = useQuery<MentorInfo>({
    queryKey: ['mentor-info'],
    queryFn: () => api.get('/students/me/mentor-info').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  const { data: sessions = [], isLoading: sessionsLoading } = useQuery<MentoringSession[]>({
    queryKey: ['mentor-sessions'],
    queryFn: () => api.get('/mentor/my-sessions').then(r => r.data),
    staleTime: 60_000,
  });

  const stats = useMemo(() => {
    const withFollowUp = sessions.filter(s => s.follow_up_required).length;
    const latest =
      sessions.length > 0
        ? formatSessionWhen(sessions[0].session_date, sessions[0].session_time)
        : null;
    return {
      total: sessions.length,
      withFollowUp,
      latest,
    };
  }, [sessions]);

  const hasAssignment = mentorInfo?.assignment_id != null;
  const mentorDisplayName =
    mentorInfo?.mentor_name?.trim() ||
    (mentorInfo?.mentor_user_id != null ? `Mentor ID: ${mentorInfo.mentor_user_id}` : null);

  if (mentorError) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800">
        Unable to load mentor information. You may need a student profile.
      </div>
    );
  }

  const loading = mentorLoading || sessionsLoading;

  return (
    <div className="space-y-8 pb-10">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900">Mentor notes</h1>
        <p className="mt-1 text-sm text-gray-500">Sessions shared by your mentor (read-only)</p>
      </div>

      {/* D) Stats */}
      {hasAssignment && !loading && (
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-gray-100 bg-gray-50/90 p-4 sm:grid-cols-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Total sessions</p>
            <p className="mt-1 text-2xl font-black text-gray-900">{stats.total}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">With follow-up</p>
            <p className="mt-1 text-2xl font-black text-amber-700">{stats.withFollowUp}</p>
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Latest session</p>
            <p className="mt-1 text-sm font-semibold text-gray-800">{stats.latest ?? '—'}</p>
          </div>
        </div>
      )}

      {/* A) Mentor card */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-6 w-6 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-gray-900">Your mentor</h2>
            {mentorLoading ? (
              <div className="mt-2 h-4 w-48 animate-pulse rounded bg-gray-100" />
            ) : !hasAssignment ? (
              <p className="mt-2 text-sm font-medium text-gray-500">No mentor assigned yet</p>
            ) : (
              <>
                <p className="mt-1 text-base font-bold text-gray-900">{mentorDisplayName}</p>
                {mentorInfo?.mentor_email && (
                  <p className="text-sm text-gray-600">{mentorInfo.mentor_email}</p>
                )}
                <p className="mt-2 text-xs text-gray-500">
                  Assignment #{mentorInfo.assignment_id}
                  {mentorInfo.mentor_name?.trim() ? '' : ' · use mentor ID until directory is linked'}
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* B) Timeline */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 animate-pulse rounded-2xl bg-gray-100" />
          ))}
        </div>
      ) : !hasAssignment ? null : sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-200 bg-gray-50/80 px-6 py-14 text-center">
          <p className="text-sm font-medium text-gray-600">
            No mentoring sessions recorded yet. Your mentor will add sessions here.
          </p>
        </div>
      ) : (
        <div className="relative border-l-2 border-gray-200 pl-6 md:pl-8">
          {sessions.map(s => (
            <div key={s.session_id} className="relative pb-10 last:pb-0">
              <span className="absolute -left-[29px] top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-white bg-primary shadow md:-left-[33px]" />
              <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-bold text-gray-900">
                    {formatSessionWhen(s.session_date, s.session_time)}
                  </p>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${sessionTypeBadgeClass(s.session_type)}`}
                  >
                    {s.session_type}
                  </span>
                </div>
                {s.duration_minutes != null && (
                  <p className="mt-1 text-xs text-gray-500">Duration: {s.duration_minutes} min</p>
                )}

                {s.topics_discussed && (
                  <div className="mt-4">
                    <TopicsBlock text={s.topics_discussed} />
                  </div>
                )}

                {s.action_items?.trim() && (
                  <div className="mt-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Action items</p>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-gray-800">
                      {s.action_items
                        .split(/\r?\n/)
                        .map(l => l.trim())
                        .filter(Boolean)
                        .map((line, i) => (
                          <li key={i}>{line}</li>
                        ))}
                    </ul>
                  </div>
                )}

                {s.follow_up_required && s.follow_up_date && (
                  <p className="mt-4 text-sm font-bold text-amber-800">
                    Follow-up: {formatFollowUpDate(s.follow_up_date)}
                  </p>
                )}

                {s.career_notes?.trim() && (
                  <div className="mt-4">
                    <CareerNotesBlock text={s.career_notes} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
