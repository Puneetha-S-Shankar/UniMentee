import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Pencil, X, Check } from 'lucide-react';
import api from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';

interface StudentMe {
  student_id: number;
  usn: string;
  program_id: number;
  batch_id: number;
  section_id: number | null;
  admission_date: string | null;
  current_semester_number: number | null;
  cgpa: number | null;
  status: string;
  user: { full_name: string; email: string };
}

interface UserOut {
  user_id: number;
  full_name: string;
  email: string;
  status: string;
}

const editSchema = z.object({
  full_name: z.string().min(2, 'Name must be at least 2 characters').max(200),
});

type EditForm = z.infer<typeof editSchema>;

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0]?.[0] ?? '?').toUpperCase();
}

function avatarHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h + name.charCodeAt(i) * (i + 1)) % 360;
  return h;
}

function statusBadgeClass(status: string): string {
  switch (status?.toUpperCase()) {
    case 'ACTIVE':
      return 'bg-emerald-100 text-emerald-900 border-emerald-200';
    case 'INACTIVE':
    case 'SUSPENDED':
      return 'bg-red-100 text-red-900 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}

type ToastState = { type: 'success' | 'error'; message: string } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [toast, onDismiss]);
  if (!toast) return null;
  return (
    <div
      className={`fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-lg ${
        toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
      role="status"
    >
      {toast.message}
    </div>
  );
}

export default function StudentProfilePage() {
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const { data, isLoading, error } = useQuery<StudentMe>({
    queryKey: ['student-me'],
    queryFn: () => api.get('/students/me').then(r => r.data),
    staleTime: 60_000,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<EditForm>({
    resolver: zodResolver(editSchema),
    defaultValues: { full_name: '' },
  });

  useEffect(() => {
    if (data?.user?.full_name) {
      reset({ full_name: data.user.full_name });
    }
  }, [data?.user?.full_name, reset]);

  const mutation = useMutation({
    mutationFn: (body: { full_name: string }) => api.put<UserOut>('/students/me/profile', body),
    onSuccess: res => {
      const u = res.data;
      const s = useAuthStore.getState();
      if (s.token && s.user) {
        useAuthStore.getState().setAuth(s.token, {
          ...s.user,
          full_name: u.full_name,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['student-me'] });
      setEditMode(false);
      setToast({ type: 'success', message: 'Profile updated' });
    },
    onError: () => setToast({ type: 'error', message: 'Could not save profile' }),
  });

  const onSave = (form: EditForm) => {
    mutation.mutate({ full_name: form.full_name.trim() });
  };

  const cancelEdit = () => {
    if (data?.user?.full_name) reset({ full_name: data.user.full_name });
    setEditMode(false);
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-sm text-red-800">
        Could not load profile. You may need an active student record.
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-32 rounded-2xl bg-gray-100" />
        <div className="h-48 rounded-2xl bg-gray-100" />
        <div className="h-64 rounded-2xl bg-gray-100" />
      </div>
    );
  }

  const name = data.user.full_name || 'Student';
  const hue = avatarHue(name);

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-10">
      <Toast toast={toast} onDismiss={() => setToast(null)} />

      {/* A) Header */}
      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
          <div
            className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full text-3xl font-black text-white shadow-inner"
            style={{ background: `linear-gradient(135deg, hsl(${hue}, 55%, 45%), hsl(${(hue + 40) % 360}, 55%, 38%))` }}
            aria-hidden
          >
            {initialsFromName(name)}
          </div>
          <div className="min-w-0 flex-1 text-center sm:text-left">
            <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 sm:text-3xl">{name}</h1>
            {editMode && (
              <p className="mt-1 text-xs font-medium text-primary">Editing — save changes in Personal info below</p>
            )}
            <span className="mt-2 inline-flex rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-semibold text-gray-600">
              {data.user.email}
            </span>
            <div className="mt-4 flex flex-wrap justify-center gap-2 sm:justify-start">
              {!editMode && (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-800 shadow-sm hover:bg-gray-50"
                >
                  <Pencil className="h-4 w-4" />
                  Edit profile
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* B) Personal */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-gray-400">Personal</h2>
        <dl className="space-y-4 text-sm">
          <div>
            <dt className="font-semibold text-gray-500">Full name</dt>
            <dd className="mt-1">
              {editMode ? (
                <>
                  <label className="sr-only" htmlFor="full_name">
                    Full name
                  </label>
                  <input
                    id="full_name"
                    {...register('full_name')}
                    className="w-full max-w-lg rounded-xl border border-gray-200 px-3 py-2 font-medium text-gray-900"
                  />
                  {errors.full_name && (
                    <p className="mt-1 text-sm text-red-600">{errors.full_name.message}</p>
                  )}
                </>
              ) : (
                <span className="text-gray-900">{data.user.full_name}</span>
              )}
            </dd>
          </div>
          <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
            <dt className="font-semibold text-gray-500">Email</dt>
            <dd className="text-gray-800">{data.user.email}</dd>
          </div>
        </dl>
        {editMode && (
          <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            <button
              type="button"
              onClick={handleSubmit(onSave)}
              disabled={mutation.isPending || !isDirty}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              Save
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Cancel
            </button>
          </div>
        )}
      </section>

      {/* C) Academic */}
      <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-extrabold uppercase tracking-wider text-gray-400">Academic</h2>
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-semibold text-gray-500">USN</dt>
            <dd className="mt-1 font-mono font-semibold text-gray-900">{data.usn}</dd>
          </div>
          <div>
            <dt className="font-semibold text-gray-500">Batch</dt>
            <dd className="mt-1 text-gray-900">{data.batch_id}</dd>
          </div>
          {data.section_id != null && (
            <div>
              <dt className="font-semibold text-gray-500">Section</dt>
              <dd className="mt-1 text-gray-900">{data.section_id}</dd>
            </div>
          )}
          {data.current_semester_number != null && (
            <div>
              <dt className="font-semibold text-gray-500">Current semester</dt>
              <dd className="mt-1 text-gray-900">{data.current_semester_number}</dd>
            </div>
          )}
          {data.cgpa != null && Number.isFinite(Number(data.cgpa)) && (
            <div>
              <dt className="font-semibold text-gray-500">CGPA</dt>
              <dd className="mt-1 font-semibold tabular-nums text-gray-900">{Number(data.cgpa).toFixed(2)}</dd>
            </div>
          )}
          <div>
            <dt className="font-semibold text-gray-500">Status</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass(data.status)}`}
              >
                {data.status}
              </span>
            </dd>
          </div>
          {data.admission_date && (
            <div>
              <dt className="font-semibold text-gray-500">Admission date</dt>
              <dd className="mt-1 text-gray-900">{formatDate(data.admission_date)}</dd>
            </div>
          )}
        </dl>
      </section>
    </div>
  );
}
