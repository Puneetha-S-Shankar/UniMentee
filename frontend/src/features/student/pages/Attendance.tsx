import { useQuery, useQueries } from '@tanstack/react-query';
import api from '../../../services/api';
import { Download, Calendar, CheckCircle2, XCircle, Circle } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Enrollment {
  enrollment_id: number;
  offering_id: number;
  subject_name: string;
  subject_code: string;
  status: string;
}

interface AttendanceSession {
  session_id: number;
  offering_id: number;
  session_date: string; // ISO date
  is_locked: boolean;
  total_present: number | null;
}

interface SubjectAttendance {
  offering_id: number;
  subject_name: string;
  subject_code: string;
  classes_held: number;
  attended: number;
  attendance_pct: number;
  status: 'Good Standing' | 'Warning' | 'Low Attendance';
}

interface CalendarDay {
  date: number;
  status: 'present' | 'absent' | 'no-class' | null;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_SUBJECTS: SubjectAttendance[] = [
  {
    offering_id: 1,
    subject_name: 'Data Structures & Algorithms',
    subject_code: 'CS301',
    classes_held: 42,
    attended: 40,
    attendance_pct: 95,
    status: 'Good Standing',
  },
  {
    offering_id: 2,
    subject_name: 'Database Management Systems',
    subject_code: 'CS302',
    classes_held: 38,
    attended: 32,
    attendance_pct: 84,
    status: 'Good Standing',
  },
  {
    offering_id: 3,
    subject_name: 'Operating Systems',
    subject_code: 'CS303',
    classes_held: 40,
    attended: 30,
    attendance_pct: 75,
    status: 'Warning',
  },
  {
    offering_id: 4,
    subject_name: 'Discrete Mathematics',
    subject_code: 'MA301',
    classes_held: 40,
    attended: 26,
    attendance_pct: 65,
    status: 'Low Attendance',
  },
];

// Mock calendar data for November 2024
const MOCK_CALENDAR_DATA: CalendarDay[] = [
  // Week 1 (Nov 1-4)
  { date: 1, status: 'present' },
  { date: 2, status: 'present' },
  { date: 3, status: 'no-class' },
  { date: 4, status: 'no-class' },
  // Week 2 (Nov 5-11)
  { date: 5, status: 'present' },
  { date: 6, status: 'present' },
  { date: 7, status: 'absent' },
  { date: 8, status: 'present' },
  { date: 9, status: 'present' },
  { date: 10, status: 'no-class' },
  { date: 11, status: 'no-class' },
  // Week 3 (Nov 12-18)
  { date: 12, status: 'present' },
  { date: 13, status: 'present' },
  { date: 14, status: 'present' },
  { date: 15, status: 'absent' },
  { date: 16, status: 'present' },
  { date: 17, status: 'no-class' },
  { date: 18, status: 'no-class' },
  // Week 4 (Nov 19-25)
  { date: 19, status: 'present' },
  { date: 20, status: 'present' },
  { date: 21, status: 'present' },
  { date: 22, status: 'present' },
  { date: 23, status: 'present' },
  { date: 24, status: 'no-class' },
  { date: 25, status: 'no-class' },
  // Week 5 (Nov 26-30)
  { date: 26, status: 'present' },
  { date: 27, status: 'present' },
  { date: 28, status: 'present' },
  { date: 29, status: 'absent' },
  { date: 30, status: 'present' },
];

// ─── Helper Functions ─────────────────────────────────────────────────────────

function getStatusBadge(status: SubjectAttendance['status']) {
  const map = {
    'Good Standing': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'Warning': 'bg-amber-50 text-amber-700 border border-amber-200',
    'Low Attendance': 'bg-red-50 text-red-600 border border-red-200',
  };
  return map[status];
}

function getProgressBarColor(status: SubjectAttendance['status']) {
  const map = {
    'Good Standing': 'bg-emerald-500',
    'Warning': 'bg-amber-500',
    'Low Attendance': 'bg-red-500',
  };
  return map[status];
}

function computeStatus(pct: number): SubjectAttendance['status'] {
  if (pct >= 85) return 'Good Standing';
  if (pct >= 75) return 'Warning';
  return 'Low Attendance';
}

// ─── Skeleton Components ──────────────────────────────────────────────────────

function KpiCardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm animate-pulse">
      <div className="h-4 w-32 bg-gray-200 rounded mb-4" />
      <div className="h-10 w-24 bg-gray-200 rounded mb-2" />
      <div className="h-3 w-40 bg-gray-100 rounded" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3 px-6 py-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex gap-4 py-3">
          <div className="h-4 bg-gray-200 rounded flex-1" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
          <div className="h-4 w-24 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

// ─── Circular Progress Ring ───────────────────────────────────────────────────

function CircularProgress({ percentage }: { percentage: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative w-32 h-32">
      <svg className="w-32 h-32 -rotate-90" viewBox="0 0 120 120">
        {/* Background circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth="10"
        />
        {/* Progress circle */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#137fec"
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-3xl font-black text-gray-900">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}

// ─── Calendar Heatmap ─────────────────────────────────────────────────────────

function CalendarHeatmap() {
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  
  // Get first day of month and total days
  const firstDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const lastDay = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
  const totalDays = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay(); // 0 = Sunday

  // Create calendar grid
  const weeks: (CalendarDay | null)[][] = [];
  let currentWeek: (CalendarDay | null)[] = [];

  // Fill initial empty days (adjust for Monday start)
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
  for (let i = 0; i < adjustedStartDay; i++) {
    currentWeek.push(null);
  }

  // Fill days
  for (let day = 1; day <= totalDays; day++) {
    const mockDay = MOCK_CALENDAR_DATA.find(d => d.date === day);
    currentWeek.push(mockDay || { date: day, status: null });

    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }

  // Fill remaining empty days
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      currentWeek.push(null);
    }
    weeks.push(currentWeek);
  }

  const weekDays = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-gray-400" />
          <h2 className="text-base font-extrabold text-gray-900">
            Attendance History - {currentMonth}
          </h2>
        </div>
        <div className="flex items-center gap-4 text-xs font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            Present
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            Absent
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            No Class
          </span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-2 mb-3">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-xs font-bold text-gray-400 text-center uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="space-y-2">
            {weeks.map((week, weekIdx) => (
              <div key={weekIdx} className="grid grid-cols-7 gap-2">
                {week.map((day, dayIdx) => (
                  <div
                    key={dayIdx}
                    className="aspect-square flex flex-col items-center justify-center rounded-lg border border-gray-100 bg-gray-50/50 relative"
                  >
                    {day && (
                      <>
                        <span className="text-sm font-semibold text-gray-700 mb-1">
                          {day.date}
                        </span>
                        <div className="flex gap-0.5">
                          {day.status === 'present' && (
                            <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          )}
                          {day.status === 'absent' && (
                            <span className="w-2 h-2 rounded-full bg-red-500" />
                          )}
                          {day.status === 'no-class' && (
                            <span className="w-2 h-2 rounded-full bg-gray-300" />
                          )}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Attendance Component ────────────────────────────────────────────────

export default function Attendance() {
  // Step 1: Fetch student profile to get student_id
  const { data: student } = useQuery({
    queryKey: ['student-me'],
    queryFn: async () => {
      const res = await api.get('/students/me');
      return res.data;
    },
    retry: 1,
  });

  const studentId = student?.student_id;

  // Step 2: Fetch enrollments
  const {
    data: enrollments,
    isLoading: enrollmentsLoading,
  } = useQuery<Enrollment[]>({
    queryKey: ['enrollments', studentId],
    queryFn: async () => {
      const res = await api.get(`/students/${studentId}/enrollments`);
      return res.data;
    },
    enabled: !!studentId,
    retry: 1,
  });

  // Step 3: Fetch sessions for each offering in parallel
  const sessionQueries = useQueries({
    queries: (enrollments || []).map((enrollment) => ({
      queryKey: ['attendance-sessions', enrollment.offering_id],
      queryFn: async () => {
        const res = await api.get(`/attendance/offerings/${enrollment.offering_id}/sessions`);
        return {
          offering_id: enrollment.offering_id,
          sessions: res.data as AttendanceSession[],
        };
      },
      retry: 1,
      enabled: !!enrollments,
    })),
  });

  // ── Compute subject attendance ──
  const isLoadingSessions = sessionQueries.some((q) => q.isLoading);
  const hasSessionErrors = sessionQueries.some((q) => q.isError);

  let subjectAttendance: SubjectAttendance[] = [];

  if (enrollments && !isLoadingSessions) {
    if (hasSessionErrors || sessionQueries.length === 0) {
      // Use mock data if API fails or no data
      subjectAttendance = MOCK_SUBJECTS;
    } else {
      subjectAttendance = enrollments
        .filter((e) => e.status === 'ENROLLED')
        .map((enrollment) => {
          const sessionData = sessionQueries.find(
            (q) => q.data?.offering_id === enrollment.offering_id
          )?.data;

          const sessions = sessionData?.sessions || [];
          const classes_held = sessions.length;
          
          // Placeholder: count sessions with total_present > 0 as attended
          // TODO: Replace with actual per-student attendance when endpoint is available
          const attended = sessions.filter((s) => s.total_present && s.total_present > 0).length;
          
          const attendance_pct = classes_held > 0 ? (attended / classes_held) * 100 : 0;
          const status = computeStatus(attendance_pct);

          return {
            offering_id: enrollment.offering_id,
            subject_name: enrollment.subject_name,
            subject_code: enrollment.subject_code,
            classes_held,
            attended,
            attendance_pct,
            status,
          };
        });

      // If no valid data, use mock
      if (subjectAttendance.length === 0) {
        subjectAttendance = MOCK_SUBJECTS;
      }
    }
  }

  // ── Compute overall metrics ──
  const overallAttendance =
    subjectAttendance.length > 0
      ? subjectAttendance.reduce((sum, s) => sum + s.attendance_pct, 0) / subjectAttendance.length
      : 0;

  const totalAttended = subjectAttendance.reduce((sum, s) => sum + s.attended, 0);
  const totalMissed = subjectAttendance.reduce((sum, s) => sum + (s.classes_held - s.attended), 0);

  const isLoading = enrollmentsLoading || isLoadingSessions;

  return (
    <div className="space-y-6 pb-8">
      {/* ── Header ── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Attendance Overview
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            Track your attendance performance across all subjects.
          </p>
        </div>
        <button className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm hover:bg-primary/90 transition-colors shadow-sm">
          <Download className="w-4 h-4" />
          Export Detailed Report
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {isLoading ? (
          <>
            <KpiCardSkeleton />
            <KpiCardSkeleton />
            <KpiCardSkeleton />
          </>
        ) : (
          <>
            {/* Overall Attendance */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                Overall Attendance
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-4xl font-black text-gray-900 leading-none mb-3">
                    {Math.round(overallAttendance)}%
                  </p>
                  <p className="text-xs font-bold text-emerald-500 flex items-center gap-1">
                    <span className="text-emerald-500">↑</span> +2% from last month
                  </p>
                </div>
                <CircularProgress percentage={overallAttendance} />
              </div>
            </div>

            {/* Total Classes Attended */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Total Classes Attended
                </p>
              </div>
              <p className="text-4xl font-black text-gray-900 leading-none mb-2">
                {totalAttended}
              </p>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full" style={{ width: '88%' }} />
              </div>
            </div>

            {/* Total Classes Missed */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-red-600" />
                </div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  Total Classes Missed
                </p>
              </div>
              <p className="text-4xl font-black text-gray-900 leading-none mb-2">
                {totalMissed}
              </p>
              <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 rounded-full" style={{ width: '12%' }} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Attendance Per Subject Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-50">
          <h2 className="text-base font-extrabold text-gray-900">Attendance Per Subject</h2>
          <div className="relative">
            <select className="appearance-none px-4 py-2 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer">
              <option>Current Semester (Fall 2024)</option>
              <option>Spring 2024</option>
              <option>Fall 2023</option>
            </select>
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <TableSkeleton />
          ) : subjectAttendance.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Circle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No attendance data available</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50">
                  <th className="px-6 py-3 text-left">Subject Name</th>
                  <th className="px-6 py-3 text-center">Classes Held</th>
                  <th className="px-6 py-3 text-center">Attended</th>
                  <th className="px-6 py-3 text-center">Attendance %</th>
                  <th className="px-6 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subjectAttendance.map((subject) => (
                  <tr
                    key={subject.offering_id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {subject.subject_name}
                        </p>
                        <p className="text-xs text-gray-400 font-medium">
                          {subject.subject_code}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-700">
                        {subject.classes_held}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-700">
                        {subject.attended}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-700 ${getProgressBarColor(
                              subject.status
                            )}`}
                            style={{ width: `${Math.min(subject.attendance_pct, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold text-gray-900 min-w-[3rem] text-right">
                          {Math.round(subject.attendance_pct)}%
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadge(
                          subject.status
                        )}`}
                      >
                        {subject.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ── Calendar Heatmap ── */}
      <CalendarHeatmap />
    </div>
  );
}
