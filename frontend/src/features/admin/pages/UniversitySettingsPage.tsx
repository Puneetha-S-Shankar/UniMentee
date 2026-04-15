import { useEffect, useState } from 'react';
import { useForm, type Resolver, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import api from '../../../services/api';
import { useSettingsStore, type UniversitySettingsDTO } from '../../../stores/settingsStore';
import { useAuthStore } from '../../../stores/authStore';

const settingsSchema = z
  .object({
    attendance_threshold: z.coerce.number().min(0, 'Min 0').max(100, 'Max 100'),
    warning_threshold: z.coerce.number().min(0, 'Min 0').max(100, 'Max 100'),
    auto_lock_hours: z.coerce.number().int().min(1).max(168),
    cgpa_good_standing: z.coerce.number().min(0).max(10),
    cgpa_warning: z.coerce.number().min(0).max(10),
    max_mentees_per_mentor: z.coerce.number().int().min(1).max(100),
    university_name: z.string(),
    university_logo_url: z.string(),
    email_alerts: z.boolean(),
    sms_alerts: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (data.warning_threshold <= data.attendance_threshold) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be greater than minimum attendance',
        path: ['warning_threshold'],
      });
    }
    if (data.cgpa_warning >= data.cgpa_good_standing) {
      ctx.addIssue({
        code: 'custom',
        message: 'Must be below good standing threshold',
        path: ['cgpa_warning'],
      });
    }
  });

type SettingsForm = z.infer<typeof settingsSchema>;

function mapDtoToForm(
  d: UniversitySettingsDTO,
  email: boolean,
  sms: boolean,
): SettingsForm {
  return {
    attendance_threshold: d.attendance_threshold,
    warning_threshold: d.warning_threshold,
    auto_lock_hours: d.auto_lock_hours,
    cgpa_good_standing: d.cgpa_good_standing,
    cgpa_warning: d.cgpa_warning,
    max_mentees_per_mentor: d.max_mentees_per_mentor,
    university_name: d.university_name ?? '',
    university_logo_url: d.university_logo_url ?? '',
    email_alerts: email,
    sms_alerts: sms,
  };
}

function Toast({
  message,
  type,
  onDismiss,
}: {
  message: string;
  type: 'success' | 'error';
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(t);
  }, [onDismiss]);
  return (
    <div
      className={`fixed bottom-6 right-6 z-50 rounded-lg px-4 py-3 text-sm font-medium text-white shadow-lg ${
        type === 'success' ? 'bg-emerald-600' : 'bg-red-600'
      }`}
      role="status"
    >
      {message}
    </div>
  );
}

function ConfirmModal({
  title,
  body,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/50" aria-label="Close" onClick={onCancel} />
      <div className="relative z-10 w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h2>
        <p className="mt-3 text-sm text-gray-600 dark:text-gray-400">{body}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UniversitySettingsPage() {
  const queryClient = useQueryClient();
  const canManage = useAuthStore((s) => s.user?.permissions.includes('ORG_MANAGE'));
  const setFromApi = useSettingsStore((s) => s.setFromApi);
  const emailAlerts = useSettingsStore((s) => s.emailAlerts);
  const smsAlerts = useSettingsStore((s) => s.smsAlerts);
  const setNotificationPrefs = useSettingsStore((s) => s.setNotificationPrefs);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingSubmit, setPendingSubmit] = useState<SettingsForm | null>(null);

  const settingsQuery = useQuery({
    queryKey: ['admin', 'settings'],
    queryFn: () => api.get<UniversitySettingsDTO>('/admin/settings').then((r) => r.data),
    enabled: !!canManage,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<SettingsForm>({
    resolver: zodResolver(settingsSchema) as Resolver<SettingsForm>,
    defaultValues: mapDtoToForm(
      {
        university_id: 0,
        attendance_threshold: 75,
        warning_threshold: 80,
        auto_lock_hours: 24,
        cgpa_good_standing: 7.5,
        cgpa_warning: 5.5,
        max_mentees_per_mentor: 20,
        university_name: '',
        university_logo_url: null,
      },
      emailAlerts,
      smsAlerts,
    ),
  });

  useEffect(() => {
    const d = settingsQuery.data;
    if (!d) return;
    const { emailAlerts: e, smsAlerts: s } = useSettingsStore.getState();
    setFromApi(d);
    reset(mapDtoToForm(d, e, s));
  }, [settingsQuery.data, reset, setFromApi]);

  const saveMutation = useMutation({
    mutationFn: (vars: { body: Record<string, unknown>; values: SettingsForm }) =>
      api.put<UniversitySettingsDTO>('/admin/settings', vars.body).then((r) => ({
        data: r.data,
        values: vars.values,
      })),
    onSuccess: ({ data, values }) => {
      setNotificationPrefs(values.email_alerts, values.sms_alerts);
      setFromApi(data);
      queryClient.setQueryData(['admin', 'settings'], data);
      setToast({ type: 'success', message: 'Settings saved successfully' });
      reset(mapDtoToForm(data, values.email_alerts, values.sms_alerts));
    },
    onError: () => {
      setToast({ type: 'error', message: 'Could not save settings. Try again.' });
    },
  });

  const runSave = (values: SettingsForm) => {
    const body = {
      attendance_threshold: values.attendance_threshold,
      warning_threshold: values.warning_threshold,
      auto_lock_hours: values.auto_lock_hours,
      cgpa_good_standing: values.cgpa_good_standing,
      cgpa_warning: values.cgpa_warning,
      max_mentees_per_mentor: values.max_mentees_per_mentor,
      university_name: values.university_name.trim() || null,
      university_logo_url: values.university_logo_url.trim() || null,
    };
    saveMutation.mutate({ body, values });
  };

  const onSubmit: SubmitHandler<SettingsForm> = (values) => {
    const serverAtt = settingsQuery.data?.attendance_threshold;
    if (serverAtt !== undefined && values.attendance_threshold !== serverAtt) {
      setPendingSubmit(values);
      setConfirmOpen(true);
      return;
    }
    runSave(values);
  };

  if (!canManage) {
    return null;
  }

  if (settingsQuery.isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-10">
        <div className="h-10 w-64 animate-pulse rounded-lg bg-gray-100 dark:bg-gray-800" />
        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-80 animate-pulse rounded-xl bg-gray-100 dark:bg-gray-800" />
          ))}
        </div>
      </div>
    );
  }

  if (settingsQuery.isError) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-red-600 dark:text-red-400">
        Failed to load settings.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      {toast ? (
        <Toast message={toast.message} type={toast.type} onDismiss={() => setToast(null)} />
      ) : null}
      {confirmOpen && pendingSubmit ? (
        <ConfirmModal
          title="Change minimum attendance?"
          body="Updating the minimum attendance threshold affects risk calculations and reporting for all students. Continue with this change?"
          confirmLabel="Save changes"
          onCancel={() => {
            setConfirmOpen(false);
            setPendingSubmit(null);
          }}
          onConfirm={() => {
            runSave(pendingSubmit);
            setConfirmOpen(false);
            setPendingSubmit(null);
          }}
        />
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            University settings
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Configure attendance rules, academic thresholds, and branding for your institution.
          </p>
        </div>
        <button
          type="submit"
          form="uni-settings-form"
          disabled={saveMutation.isPending || !isDirty}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saveMutation.isPending ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <form id="uni-settings-form" className="mt-8 space-y-8" onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-6 lg:grid-cols-3">
          {/* A) Attendance */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Attendance</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Controls how attendance risk and low-attendance flags are computed.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Minimum attendance threshold
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 shadow-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    {...register('attendance_threshold')}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Students below this percentage in a subject are flagged as low attendance.
                </p>
                {errors.attendance_threshold ? (
                  <p className="mt-1 text-xs text-red-600">{errors.attendance_threshold.message}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Warning threshold
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    step="0.1"
                    className="block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                    {...register('warning_threshold')}
                  />
                  <span className="text-sm text-gray-500">%</span>
                </div>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Early warning band above the minimum; use for alerts before a student falls below the
                  minimum.
                </p>
                {errors.warning_threshold ? (
                  <p className="mt-1 text-xs text-red-600">{errors.warning_threshold.message}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Auto-lock hours
                </label>
                <input
                  type="number"
                  min={1}
                  max={168}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  {...register('auto_lock_hours')}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  After this many hours without activity, relevant records may be locked from edits
                  (policy-dependent).
                </p>
                {errors.auto_lock_hours ? (
                  <p className="mt-1 text-xs text-red-600">{errors.auto_lock_hours.message}</p>
                ) : null}
              </div>
            </div>
          </section>

          {/* B) Academic */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Academic</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              CGPA bands and mentoring capacity for your university.
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  CGPA good standing
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  {...register('cgpa_good_standing')}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Students at or above this CGPA are considered in good academic standing.
                </p>
                {errors.cgpa_good_standing ? (
                  <p className="mt-1 text-xs text-red-600">{errors.cgpa_good_standing.message}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  CGPA warning (probation)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  {...register('cgpa_warning')}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Below this CGPA, students are treated as at-risk / probation for analytics and mentor
                  load.
                </p>
                {errors.cgpa_warning ? (
                  <p className="mt-1 text-xs text-red-600">{errors.cgpa_warning.message}</p>
                ) : null}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Max mentees per mentor
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  {...register('max_mentees_per_mentor')}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Caps how many active mentees can be assigned to one mentor.
                </p>
                {errors.max_mentees_per_mentor ? (
                  <p className="mt-1 text-xs text-red-600">{errors.max_mentees_per_mentor.message}</p>
                ) : null}
              </div>
            </div>
          </section>

          {/* C) System */}
          <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">System</h2>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Branding and notification preferences (alerts are UI-only for now).
            </p>
            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  University name
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  {...register('university_name')}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Logo URL
                </label>
                <input
                  type="text"
                  inputMode="url"
                  placeholder="https://…"
                  className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  {...register('university_logo_url')}
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Paste an image URL; file upload can be added later.
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Notification preferences
                </p>
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" className="rounded border-gray-300 text-primary" {...register('email_alerts')} />
                  Email alerts
                </label>
                <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <input type="checkbox" className="rounded border-gray-300 text-primary" {...register('sms_alerts')} />
                  SMS alerts
                </label>
              </div>
            </div>
          </section>
        </div>
      </form>
    </div>
  );
}
