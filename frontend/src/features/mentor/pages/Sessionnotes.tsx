import { useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Bell, Search, ChevronDown } from 'lucide-react';
import api from '../../../services/api';

// ─── Schema ───────────────────────────────────────────────────────────────────

const schema = z.object({
  session_type: z.enum(['Academic Review', 'Career Mentoring', 'Probation Review', 'General Check-in']),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  topics_discussed: z.string().optional(),
  action_items: z.string().optional(),
  risk_category: z.enum(['NO_RISK', 'ATTENDANCE_RISK', 'ACADEMIC_RISK']),
  follow_up_required: z.boolean(),
  follow_up_date: z.string().optional(),
}).refine(
  data => !data.follow_up_required || (data.follow_up_date && data.follow_up_date.length > 0),
  { message: 'Follow-up date is required when follow-up is enabled', path: ['follow_up_date'] }
);

type FormData = z.infer<typeof schema>;

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentProfile {
  id: number;
  name: string;
  usn: string;
}

interface Assignment {
  id: number;
  student_id: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().split('T')[0];
}

function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
      {children}
      {required && <span className="text-red-400 ml-0.5">*</span>}
    </label>
  );
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-red-500 mt-1">{message}</p>;
}

const inputClass =
  'w-full px-3.5 py-2.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition placeholder:text-gray-400';

const selectClass =
  'w-full px-3.5 py-2.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition appearance-none cursor-pointer pr-9';

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      className={`relative inline-flex w-10 h-5.5 rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 ${value ? 'bg-primary' : 'bg-gray-300'}`}
      style={{ height: '22px', width: '40px' }}
    >
      <span
        className={`inline-block w-4.5 h-4.5 rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-[3px] ${value ? 'translate-x-[19px]' : 'translate-x-[3px]'}`}
        style={{ width: '16px', height: '16px' }}
      />
    </button>
  );
}

// ─── Risk Radio ───────────────────────────────────────────────────────────────

const RISK_OPTIONS = [
  { value: 'NO_RISK', label: 'No Risk', dotColor: 'bg-green-500', ringColor: 'ring-green-400', selectedBg: 'bg-green-50 border-green-400' },
  { value: 'ATTENDANCE_RISK', label: 'Attendance Risk', dotColor: 'bg-orange-400', ringColor: 'ring-orange-400', selectedBg: 'bg-orange-50 border-orange-400' },
  { value: 'ACADEMIC_RISK', label: 'Academic Risk', dotColor: 'bg-red-500', ringColor: 'ring-red-400', selectedBg: 'bg-red-50 border-red-400' },
] as const;

function RiskRadioGroup({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}) {
  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {RISK_OPTIONS.map(opt => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-semibold transition
                ${selected
                  ? `${opt.selectedBg} border-current`
                  : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
            >
              <span className={`w-2.5 h-2.5 rounded-full ${opt.dotColor} ${selected ? '' : 'opacity-60'}`} />
              {opt.label}
            </button>
          );
        })}
      </div>
      <FieldError message={error} />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionNote() {
  const { studentId } = useParams<{ studentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Also support ?studentId= from quick-add on mentee list
  const resolvedStudentId = Number(studentId ?? searchParams.get('studentId'));

  // Fetch student name for display
  const { data: student } = useQuery<StudentProfile>({
    queryKey: ['student-basic', resolvedStudentId],
    queryFn: () => api.get(`/students/${resolvedStudentId}`).then(r => r.data),
    enabled: !!resolvedStudentId,
  });

  // Find assignment ID
  const { data: assignments = [] } = useQuery<Assignment[]>({
    queryKey: ['mentor-assignments-session'],
    queryFn: () => api.get('/mentor/assignments').then(r => r.data),
  });
  const assignment = assignments.find(a => a.student_id === resolvedStudentId);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      session_type: 'Academic Review',
      date: today(),
      time: nowTime(),
      topics_discussed: '',
      action_items: '',
      risk_category: 'NO_RISK',
      follow_up_required: false,
      follow_up_date: '',
    },
  });

  const followUpRequired = watch('follow_up_required');

  const mutation = useMutation({
    mutationFn: (data: FormData) => {
      if (!assignment) throw new Error('Assignment not found');
      const payload = {
        ...data,
        scheduled_at: `${data.date}T${data.time}`,
      };
      return api.post(`/mentor/assignments/${assignment.id}/sessions`, payload);
    },
    onSuccess: () => {
      navigate(`/mentor/students/${resolvedStudentId}`);
    },
  });

  const onSubmit = (data: FormData) => mutation.mutate(data);

  const handleCancel = () => {
    if (resolvedStudentId) navigate(`/mentor/students/${resolvedStudentId}`);
    else navigate('/mentor/mentees');
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-display">

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search student by name or ID..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none transition"
              readOnly
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><Bell size={16} /></button>
          <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold">DS</div>
        </div>
      </div>

      {/* Page Header */}
      <div className="px-8 pt-7 pb-2 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900">Add Mentor Session Note</h1>
        <p className="text-xs text-gray-400 mt-0.5">Document the interaction and feedback for the student record.</p>
      </div>

      {/* Form Card */}
      <div className="px-8 pb-10 max-w-3xl mx-auto">
        <form onSubmit={handleSubmit(onSubmit)} noValidate>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-7 space-y-6">

            {/* Student Name */}
            <div>
              <FieldLabel required>Student Name</FieldLabel>
              <div className="relative">
                <Search size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  readOnly
                  value={student ? `${student.name} - ${student.usn}` : 'Loading...'}
                  className={`${inputClass} pl-9 bg-gray-50 cursor-default text-gray-600`}
                />
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Session Type */}
            <div>
              <FieldLabel required>Session Type</FieldLabel>
              <div className="relative">
                <select {...register('session_type')} className={selectClass}>
                  <option>Academic Review</option>
                  <option>Career Mentoring</option>
                  <option>Probation Review</option>
                  <option>General Check-in</option>
                </select>
                <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <FieldError message={errors.session_type?.message} />
            </div>

            {/* Date + Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <FieldLabel required>Date</FieldLabel>
                <input type="date" {...register('date')} className={inputClass} />
                <FieldError message={errors.date?.message} />
              </div>
              <div>
                <FieldLabel required>Time</FieldLabel>
                <input type="time" {...register('time')} className={inputClass} />
                <FieldError message={errors.time?.message} />
              </div>
            </div>

            {/* Mentor Notes / Topics Discussed */}
            <div>
              <FieldLabel>Mentor Notes</FieldLabel>
              <textarea
                {...register('topics_discussed')}
                rows={4}
                placeholder="Record discussion details here..."
                className={`${inputClass} resize-none`}
              />
              <FieldError message={errors.topics_discussed?.message} />
            </div>

            {/* Academic Risk Category */}
            <div>
              <FieldLabel required>Academic Risk Category</FieldLabel>
              <Controller
                control={control}
                name="risk_category"
                render={({ field }) => (
                  <RiskRadioGroup
                    value={field.value}
                    onChange={field.onChange}
                    error={errors.risk_category?.message}
                  />
                )}
              />
            </div>

            {/* Action Items */}
            <div>
              <FieldLabel>Action Items</FieldLabel>
              <textarea
                {...register('action_items')}
                rows={3}
                placeholder="Recommended next steps and tasks for the student..."
                className={`${inputClass} resize-none`}
              />
              <FieldError message={errors.action_items?.message} />
            </div>

            {/* Follow-Up Required */}
            <div className="flex items-start justify-between gap-4 py-1">
              <div>
                <p className="text-sm font-semibold text-gray-700">Follow-Up Required</p>
                <p className="text-xs text-gray-400 mt-0.5">Schedule a reminder for a future meeting.</p>
              </div>
              <Controller
                control={control}
                name="follow_up_required"
                render={({ field }) => (
                  <Toggle value={field.value} onChange={field.onChange} />
                )}
              />
            </div>

            {/* Follow-Up Date (conditional) */}
            {followUpRequired && (
              <div className="border-t border-gray-100 pt-5">
                <FieldLabel required>Follow-Up Date</FieldLabel>
                <input
                  type="date"
                  {...register('follow_up_date')}
                  min={today()}
                  className={inputClass}
                />
                <FieldError message={errors.follow_up_date?.message} />
              </div>
            )}

            {/* Error banner */}
            {mutation.isError && (
              <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                Failed to save session note. Please try again.
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
              <button
                type="submit"
                disabled={isSubmitting || mutation.isPending || !assignment}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-blue-600 text-white text-sm font-bold transition shadow-sm disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {(isSubmitting || mutation.isPending) ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Saving...
                  </>
                ) : 'Save Session Note'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="px-6 py-3 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
}
