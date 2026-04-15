import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Pencil, LogOut, Bell, Shield, Smartphone,
  KeyRound, AlertTriangle, ChevronRight, Check, X
} from 'lucide-react';
import api from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface UserProfile {
  id: number;
  name: string;
  email: string;
  phone?: string;
  university_id: string;
  department?: string;
  role: string;
  photo_url?: string;
  two_factor_enabled?: boolean;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().optional(),
});

const passwordSchema = z.object({
  current_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(8, 'Must be at least 8 characters'),
  confirm_password: z.string(),
}).refine(d => d.new_password === d.confirm_password, {
  message: 'Passwords do not match',
  path: ['confirm_password'],
});

type ProfileForm = z.infer<typeof profileSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roleLabel(role: string) {
  const map: Record<string, string> = {
    STUDENT: 'Student', MENTOR: 'Mentor', FACULTY: 'Faculty',
    PARENT: 'Parent', HOD: 'Head of Department', ADMIN: 'Administrator',
    DEAN: 'Dean', REGISTRAR: 'Registrar',
  };
  return map[role] ?? role;
}

function roleBadgeColor(role: string) {
  const map: Record<string, string> = {
    STUDENT: 'bg-blue-100 text-blue-700',
    MENTOR: 'bg-violet-100 text-violet-700',
    FACULTY: 'bg-green-100 text-green-700',
    PARENT: 'bg-orange-100 text-orange-700',
    HOD: 'bg-purple-100 text-purple-700',
    ADMIN: 'bg-red-100 text-red-600',
  };
  return map[role] ?? 'bg-gray-100 text-gray-600';
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ value, onChange, disabled }: { value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      disabled={disabled}
      onClick={() => !disabled && onChange(!value)}
      className={`relative inline-flex rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-40 disabled:cursor-not-allowed shrink-0
        ${value ? 'bg-primary' : 'bg-gray-300'}`}
      style={{ width: 44, height: 24 }}
    >
      <span
        className="inline-block rounded-full bg-white shadow-sm transform transition-transform duration-200 mt-[3px]"
        style={{
          width: 18, height: 18,
          transform: value ? 'translateX(23px)' : 'translateX(3px)',
        }}
      />
    </button>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

function Field({
  label, value, readOnly = false, icon
}: { label: string; value?: string; readOnly?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-gray-400 font-medium">{label}</label>
      <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm
        ${readOnly ? 'bg-gray-50 border-gray-100 text-gray-500' : 'bg-white border-gray-200 text-gray-800'}`}>
        {icon && <span className="text-gray-400 shrink-0">{icon}</span>}
        <span className="truncate">{value ?? '—'}</span>
      </div>
    </div>
  );
}

// ─── Password Modal ───────────────────────────────────────────────────────────

function PasswordModal({ onClose }: { onClose: () => void }) {
  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<PasswordForm>({
    resolver: zodResolver(passwordSchema),
  });
  const [success, setSuccess] = useState(false);

  const onSubmit = async (data: PasswordForm) => {
    await api.post('/auth/change-password', data);
    setSuccess(true);
    setTimeout(() => { onClose(); reset(); }, 1500);
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-bold text-gray-900">Change Password</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition">
              <X size={16} />
            </button>
          </div>

          {success ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <Check size={20} className="text-green-600" />
              </div>
              <p className="text-sm font-semibold text-gray-700">Password updated successfully!</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {[
                { name: 'current_password' as const, label: 'Current Password' },
                { name: 'new_password' as const, label: 'New Password' },
                { name: 'confirm_password' as const, label: 'Confirm New Password' },
              ].map(f => (
                <div key={f.name}>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{f.label}</label>
                  <input
                    type="password"
                    {...register(f.name)}
                    className="w-full mt-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition"
                  />
                  {errors[f.name] && (
                    <p className="text-xs text-red-500 mt-1">{errors[f.name]?.message}</p>
                  )}
                </div>
              ))}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-blue-600 text-white text-sm font-bold transition disabled:opacity-60 mt-2"
              >
                {isSubmitting ? 'Updating...' : 'Update Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Deactivate Modal ─────────────────────────────────────────────────────────

function DeactivateModal({ onClose }: { onClose: () => void }) {
  const clearAuth = useAuthStore(s => s.clearAuth);
  const [loading, setLoading] = useState(false);

  const handleDeactivate = async () => {
    setLoading(true);
    await api.post('/auth/deactivate');
    clearAuth();
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <AlertTriangle size={20} className="text-red-500" />
          </div>
          <h3 className="font-bold text-gray-900 text-center text-lg">Deactivate Account</h3>
          <p className="text-sm text-gray-500 text-center mt-2 leading-relaxed">
            This will temporarily disable your profile and access. You can reactivate it by contacting your administrator.
          </p>
          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
            >
              Cancel
            </button>
            <button
              onClick={handleDeactivate}
              disabled={loading}
              className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-bold transition disabled:opacity-60"
            >
              {loading ? 'Deactivating...' : 'Deactivate'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const clearAuth = useAuthStore(s => s.clearAuth);
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showDeactivateModal, setShowDeactivateModal] = useState(false);

  const [notifs, setNotifs] = useState({
    mentor_messages: true,
    academic_alerts: true,
    attendance_warnings: false,
  });

  const [twoFactor, setTwoFactor] = useState(false);

  const { data: profile, isLoading } = useQuery<UserProfile>({
    queryKey: ['auth-me'],
    queryFn: () => api.get('/auth/me').then(r => {
      setTwoFactor(r.data.two_factor_enabled ?? false);
      return r.data;
    }),
  });

  const { register, handleSubmit, reset, formState: { errors, isDirty, isSubmitting } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    values: profile ? { name: profile.name, phone: profile.phone ?? '' } : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (data: ProfileForm) => api.patch('/auth/me', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      setEditMode(false);
    },
  });

  const onSubmit = (data: ProfileForm) => updateMutation.mutate(data);

  const handleCancelEdit = () => {
    reset();
    setEditMode(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-display">

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center sticky top-0 z-20 shadow-sm">
        <div className="flex-1">
          <h1 className="text-base font-bold text-gray-900">Profile & Account Settings</h1>
          <p className="text-xs text-gray-400">Manage your personal information and notification preferences.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
            <Bell size={16} />
          </button>
          <button
            onClick={clearAuth}
            className="flex items-center gap-1.5 text-sm font-semibold text-gray-600 hover:text-red-500 px-3 py-1.5 rounded-lg hover:bg-red-50 transition"
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      </div>

      <div className="p-6 max-w-3xl mx-auto space-y-5">

        {/* Profile Card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          {isLoading ? (
            <div className="flex gap-5">
              <Skeleton className="w-20 h-20 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-20" />
                <div className="grid grid-cols-2 gap-3 mt-4">
                  {[1,2,3,4].map(i => <Skeleton key={i} className="h-12" />)}
                </div>
              </div>
            </div>
          ) : profile ? (
            <form onSubmit={handleSubmit(onSubmit)}>
              <div className="flex items-start justify-between gap-4 mb-5">
                <div className="flex items-center gap-4">
                  {/* Avatar */}
                  <div className="relative">
                    {profile.photo_url
                      ? <img src={profile.photo_url} alt={profile.name} className="w-20 h-20 rounded-full object-cover border-2 border-gray-100" />
                      : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-100 to-violet-100 flex items-center justify-center text-2xl font-bold text-violet-500 border-2 border-gray-100">
                          {profile.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                      )
                    }
                    {editMode && (
                      <button type="button" className="absolute bottom-0 right-0 w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md border-2 border-white">
                        <Pencil size={10} className="text-white" />
                      </button>
                    )}
                  </div>

                  <div>
                    <h2 className="text-xl font-bold text-gray-900">{profile.name}</h2>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${roleBadgeColor(profile.role)}`}>
                      {roleLabel(profile.role)}
                    </span>
                  </div>
                </div>

                {/* Edit / Save / Cancel */}
                {!editMode ? (
                  <button
                    type="button"
                    onClick={() => setEditMode(true)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-sm transition"
                  >
                    <Pencil size={13} />
                    Edit Profile
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="px-3 py-2 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!isDirty || isSubmitting}
                      className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-blue-600 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50"
                    >
                      <Check size={13} />
                      {isSubmitting ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              {/* Fields Grid */}
              <div className="grid grid-cols-2 gap-4">
                {/* Name — editable */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400 font-medium">Full Name</label>
                  {editMode ? (
                    <>
                      <input
                        {...register('name')}
                        className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition"
                      />
                      {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                    </>
                  ) : (
                    <Field label="" value={profile.name} />
                  )}
                </div>

                {/* Email — always readonly */}
                <Field label="Email Address" value={profile.email} readOnly />

                {/* Phone — editable */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-gray-400 font-medium">Phone Number</label>
                  {editMode ? (
                    <>
                      <input
                        {...register('phone')}
                        placeholder="+1 (000) 000-0000"
                        className="px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition"
                      />
                      {errors.phone && <p className="text-xs text-red-500">{errors.phone.message}</p>}
                    </>
                  ) : (
                    <Field label="" value={profile.phone ?? 'Not set'} readOnly={!editMode} />
                  )}
                </div>

                {/* University ID — always readonly */}
                <Field label="University ID" value={profile.university_id} readOnly />

                {/* Department — readonly */}
                <Field label="Department" value={profile.department} readOnly />
              </div>

              {updateMutation.isError && (
                <p className="text-xs text-red-500 mt-3">Failed to save changes. Please try again.</p>
              )}
            </form>
          ) : null}
        </div>

        {/* Bottom grid — Account Settings + Notification Prefs */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Account Settings */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Shield size={15} className="text-primary" />
              <h3 className="font-bold text-gray-900 text-sm">Account Settings</h3>
            </div>

            <div className="space-y-1">
              {/* Change Password */}
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Change Password</p>
                  <p className="text-xs text-gray-400 mt-0.5">Update your account password regularly</p>
                </div>
                <button
                  onClick={() => setShowPasswordModal(true)}
                  className="text-sm font-bold text-primary hover:text-blue-700 transition"
                >
                  Update
                </button>
              </div>

              {/* 2FA */}
              <div className="flex items-center justify-between py-3 border-b border-gray-50">
                <div>
                  <p className="text-sm font-semibold text-gray-800">Two-Factor Authentication</p>
                  <p className="text-xs text-gray-400 mt-0.5">Add an extra layer of security</p>
                </div>
                <Toggle value={twoFactor} onChange={setTwoFactor} />
              </div>

              {/* Connected Devices */}
              <div className="flex items-center justify-between py-3">
                <div className="flex items-center gap-2.5">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">Connected Devices</p>
                    <p className="text-xs text-gray-400 mt-0.5">Manage your active sessions</p>
                  </div>
                </div>
                <button className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 transition">
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Notification Preferences */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Bell size={15} className="text-primary" />
              <h3 className="font-bold text-gray-900 text-sm">Notification Preferences</h3>
            </div>

            <div className="space-y-1">
              {[
                { key: 'mentor_messages' as const, label: 'Mentor Messages', desc: 'Get notified when a mentor contacts you' },
                { key: 'academic_alerts' as const, label: 'Academic Alerts', desc: 'Updates on grades and assessments' },
                { key: 'attendance_warnings' as const, label: 'Attendance Warnings', desc: 'Critical alerts for low attendance' },
              ].map((item, idx, arr) => (
                <div
                  key={item.key}
                  className={`flex items-center justify-between py-3 ${idx < arr.length - 1 ? 'border-b border-gray-50' : ''}`}
                >
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{item.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.desc}</p>
                  </div>
                  <Toggle
                    value={notifs[item.key]}
                    onChange={v => setNotifs(n => ({ ...n, [item.key]: v }))}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Deactivate Account */}
        <div className="bg-red-50 border border-red-100 rounded-2xl px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-red-600">Deactivate Account</p>
            <p className="text-xs text-red-400 mt-0.5">Temporarily disable your profile and access</p>
          </div>
          <button
            onClick={() => setShowDeactivateModal(true)}
            className="text-sm font-bold text-red-500 hover:text-red-700 transition"
          >
            Deactivate
          </button>
        </div>

      </div>

      {/* Modals */}
      {showPasswordModal && <PasswordModal onClose={() => setShowPasswordModal(false)} />}
      {showDeactivateModal && <DeactivateModal onClose={() => setShowDeactivateModal(false)} />}
    </div>
  );
}
