import { useNavigate } from 'react-router-dom';
import { Plus, Calendar } from 'lucide-react';
import type { MentorSessionRow } from './types';

function formatDate(iso: string) {
  try {
    return new Date(iso + (iso.length <= 10 ? 'T12:00:00' : '')).toLocaleString(undefined, {
      dateStyle: 'medium',
    });
  } catch {
    return iso;
  }
}

export function MenteeSessionsTab({
  sessions,
  studentId,
  assignmentId,
}: {
  sessions: MentorSessionRow[];
  studentId: number;
  assignmentId: number | null;
}) {
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Mentoring session log for this assignment.</p>
        <button
          type="button"
          disabled={!assignmentId}
          onClick={() => {
            if (!assignmentId) return;
            navigate(
              `/mentor/sessions/new?studentId=${studentId}&assignmentId=${assignmentId}`
            );
          }}
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          Record new session
        </button>
      </div>

      {!sessions.length ? (
        <p className="rounded-2xl border border-dashed border-gray-200 bg-white py-12 text-center text-sm text-gray-500">
          No sessions recorded yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {sessions.map((s) => (
            <li
              key={s.session_id}
              className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm"
            >
              <div className="flex flex-wrap items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900">{formatDate(s.session_date)}</span>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                      {s.session_type?.replace(/_/g, ' ') ?? 'Session'}
                    </span>
                  </div>
                  {s.topics_discussed && (
                    <p className="mt-2 text-sm text-gray-700">
                      <span className="font-medium text-gray-500">Topics: </span>
                      {s.topics_discussed}
                    </p>
                  )}
                  {s.action_items && (
                    <p className="mt-1 text-sm text-gray-600">
                      <span className="font-medium text-gray-500">Actions: </span>
                      {s.action_items}
                    </p>
                  )}
                  {s.follow_up_required && s.follow_up_date && (
                    <p className="mt-2 text-xs font-medium text-amber-800">
                      Follow-up: {formatDate(s.follow_up_date)}
                    </p>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
