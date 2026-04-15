import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronDown } from 'lucide-react';
import api from '../../../services/api';
import { usePermission } from '../../../hooks/usePermission';

const SESSION_TYPES = ['ACADEMIC', 'PERSONAL', 'CAREER', 'DISCIPLINARY', 'GENERAL'] as const;

interface MenteeRow {
  assignment_id: number;
  student: { student_id: number; full_name: string; usn: string };
}

interface AssignmentRow {
  assignment_id: number;
  student_id: number;
}

function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}

function tomorrowISODate() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const schema = z
  .object({
    menteeStudentId: z.coerce.number().positive('Select a mentee'),
    session_date: z.string().min(1, 'Required'),
    session_time: z.string().optional(),
    duration_minutes: z.string().optional(),
    session_type: z.enum(SESSION_TYPES),
    topics_discussed: z.string().min(20, 'At least 20 characters'),
    action_items: z.string().optional(),
    follow_up_required: z.boolean(),
    follow_up_date: z.string().optional(),
    career_notes: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const sd = new Date(data.session_date + 'T12:00:00');
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (sd > today) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Session date cannot be in the future', path: ['session_date'] });
    }
    const durStr = (data.duration_minutes ?? '').trim();
    if (durStr) {
      const d = Number(durStr);
      if (Number.isNaN(d) || d < 5 || d > 480) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Duration must be between 5 and 480 minutes',
          path: ['duration_minutes'],
        });
      }
    }
    if (data.follow_up_required) {
      if (!data.follow_up_date || !data.follow_up_date.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Follow-up date is required',
          path: ['follow_up_date'],
        });
        return;
      }
      const fu = new Date(data.follow_up_date + 'T12:00:00');
      const startTomorrow = new Date();
      startTomorrow.setDate(startTomorrow.getDate() + 1);
      startTomorrow.setHours(0, 0, 0, 0);
      if (fu < startTomorrow) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Follow-up date must be tomorrow or later',
          path: ['follow_up_date'],
        });
      }
    }
  });

type FormData = z.infer<typeof schema>;

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

export default function NewSessionPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const canView = usePermission('STUDENT_VIEW');

  const paramStudentId = searchParams.get('studentId');
  const paramAssignmentId = searchParams.get('assignmentId');

  const [careerOpen, setCareerOpen] = useState(false);

  const { data: mentees = [], isLoading: menteesLoading } = useQuery<MenteeRow[]>({
    queryKey: ['mentor-mentees-new-session'],
    queryFn: () => api.get('/mentor/mentees').then((r) => r.data),
    enabled: canView,
  });

  const { data: assignments = [] } = useQuery<AssignmentRow[]>({
    queryKey: ['mentor-assignments-new-session'],
    queryFn: () => api.get('/mentor/assignments').then((r) => r.data),
    enabled: canView,
  });

  const defaultStudentId = useMemo(() => {
    if (paramStudentId) return Number(paramStudentId);
    if (paramAssignmentId) {
      const a = assignments.find((x) => x.assignment_id === Number(paramAssignmentId));
      return a?.student_id ?? 0;
    }
    return 0;
  }, [paramStudentId, paramAssignmentId, assignments]);

  const lockedStudent = !!(paramStudentId && Number(paramStudentId) > 0);

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      menteeStudentId: 0,
      session_date: todayISODate(),
      session_time: '',
      duration_minutes: '',
      session_type: 'ACADEMIC',
      topics_discussed: '',
      action_items: '',
      follow_up_required: false,
      follow_up_date: '',
      career_notes: '',
    },
  });

  const followUpRequired = watch('follow_up_required');

  useEffect(() => {
    if (!defaultStudentId || !mentees.length) return;
    const exists = mentees.some((m) => m.student.student_id === defaultStudentId);
    if (exists) {
      reset((prev) => ({
        ...prev,
        menteeStudentId: defaultStudentId,
      }));
    }
  }, [defaultStudentId, mentees, reset]);

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const assignment = assignments.find((a) => a.student_id === data.menteeStudentId);
      if (!assignment) throw new Error('No assignment for selected mentee');

      let session_time: string | null = null;
      if (data.session_time && data.session_time.trim()) {
        const t = data.session_time.trim();
        session_time = t.length === 5 ? `${t}:00` : t;
      }

      const body: Record<string, unknown> = {
        session_date: data.session_date,
        session_type: data.session_type,
        topics_discussed: data.topics_discussed,
        action_items: data.action_items || null,
        follow_up_required: data.follow_up_required,
        follow_up_date: data.follow_up_required && data.follow_up_date ? data.follow_up_date : null,
        career_notes: data.career_notes || null,
      };
      if (session_time) body.session_time = session_time;
      const durStr = (data.duration_minutes ?? '').trim();
      if (durStr) {
        const d = Number(durStr);
        if (!Number.isNaN(d)) body.duration_minutes = d;
      }

      await api.post(`/mentor/assignments/${assignment.assignment_id}/sessions`, body);
      return { studentId: data.menteeStudentId, assignmentId: assignment.assignment_id };
    },
    onSuccess: ({ studentId, assignmentId }) => {
      queryClient.invalidateQueries({ queryKey: ['mentor-assignment-sessions', assignmentId] });
      queryClient.invalidateQueries({ queryKey: ['mentor-assignment-sessions'] });
      queryClient.invalidateQueries({ queryKey: ['mentor-assignments-sessions-page'] });
      queryClient.invalidateQueries({ queryKey: ['mentor-dashboard-stats'] });
      navigate(`/mentor/mentees/${studentId}?tab=sessions`);
    },
  });

  if (!canView) {
    return (
      <div className="rounded-2xl border border-amber-100 bg-amber-50 p-6 text-sm text-amber-900">
        You need <strong>STUDENT_VIEW</strong> to record sessions.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 pb-10">
      <Link
        to="/mentor/sessions"
        className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        <ChevronLeft className="h-4 w-4" />
        All sessions
      </Link>

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Record session</h1>
        <p className="mt-1 text-sm text-gray-500">Log a mentoring session for one of your mentees.</p>
      </div>

      <form
        onSubmit={handleSubmit((data) => mutation.mutate(data))}
        className="space-y-5 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Mentee *</label>
          <select
            {...register('menteeStudentId', { valueAsNumber: true })}
            disabled={lockedStudent || menteesLoading}
            className={inputClass + ' disabled:bg-gray-50'}
          >
            <option value={0}>Select mentee</option>
            {mentees.map((m) => (
              <option key={m.assignment_id} value={m.student.student_id}>
                {m.student.full_name} ({m.student.usn})
              </option>
            ))}
          </select>
          {errors.menteeStudentId && (
            <p className="mt-1 text-xs text-red-600">{errors.menteeStudentId.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Session date *</label>
            <input type="date" {...register('session_date')} max={todayISODate()} className={inputClass} />
            {errors.session_date && (
              <p className="mt-1 text-xs text-red-600">{errors.session_date.message}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Session time</label>
            <input type="time" {...register('session_time')} className={inputClass} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Session type *</label>
            <select {...register('session_type')} className={inputClass}>
              {SESSION_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Duration (minutes)</label>
            <input
              type="number"
              min={5}
              max={480}
              placeholder="Optional (5–480)"
              {...register('duration_minutes')}
              className={inputClass}
            />
            {errors.duration_minutes && (
              <p className="mt-1 text-xs text-red-600">{errors.duration_minutes.message}</p>
            )}
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Topics discussed *</label>
          <textarea
            {...register('topics_discussed')}
            rows={4}
            placeholder="Minimum 20 characters"
            className={inputClass}
          />
          {errors.topics_discussed && (
            <p className="mt-1 text-xs text-red-600">{errors.topics_discussed.message}</p>
          )}
        </div>

        <div>
          <label className="mb-1 block text-xs font-semibold text-gray-500">Action items</label>
          <textarea {...register('action_items')} rows={3} className={inputClass} />
        </div>

        <Controller
          name="follow_up_required"
          control={control}
          render={({ field }) => (
            <label className="flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <span className="text-sm font-medium text-gray-800">Follow-up required</span>
            </label>
          )}
        />

        {followUpRequired && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-500">Follow-up date *</label>
            <input
              type="date"
              {...register('follow_up_date')}
              min={tomorrowISODate()}
              className={inputClass}
            />
            {errors.follow_up_date && (
              <p className="mt-1 text-xs text-red-600">{errors.follow_up_date.message}</p>
            )}
          </div>
        )}

        <div className="rounded-xl border border-gray-100">
          <button
            type="button"
            onClick={() => setCareerOpen((o) => !o)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-800"
          >
            Career notes (optional)
            <ChevronDown className={`h-4 w-4 transition ${careerOpen ? 'rotate-180' : ''}`} />
          </button>
          {careerOpen && (
            <div className="border-t border-gray-100 px-4 pb-4">
              <textarea {...register('career_notes')} rows={3} className={inputClass + ' mt-2'} />
            </div>
          )}
        </div>

        {mutation.isError && (
          <p className="text-sm text-red-600">
            {(mutation.error as Error)?.message || 'Could not save session'}
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isSubmitting || mutation.isPending}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
          >
            {mutation.isPending ? 'Saving…' : 'Save session'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/mentor/sessions')}
            className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
