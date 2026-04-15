import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Mirrors GET /admin/settings (server-backed fields). */
export interface UniversitySettingsDTO {
  setting_id?: number;
  university_id: number;
  attendance_threshold: number;
  warning_threshold: number;
  auto_lock_hours: number;
  cgpa_good_standing: number;
  cgpa_warning: number;
  max_mentees_per_mentor: number;
  university_name: string | null;
  university_logo_url: string | null;
}

interface SettingsState {
  settings: UniversitySettingsDTO | null;
  /** UI-only until backend exists */
  emailAlerts: boolean;
  smsAlerts: boolean;
  setFromApi: (data: UniversitySettingsDTO) => void;
  setNotificationPrefs: (email: boolean, sms: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      settings: null,
      emailAlerts: true,
      smsAlerts: false,
      setFromApi: (data) => set({ settings: data }),
      setNotificationPrefs: (email, sms) => set({ emailAlerts: email, smsAlerts: sms }),
    }),
    {
      name: 'uni-settings',
      partialize: (s) => ({
        emailAlerts: s.emailAlerts,
        smsAlerts: s.smsAlerts,
        settings: s.settings,
      }),
    },
  ),
);
