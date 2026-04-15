import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import {
  GraduationCap, BookOpen, Bell,
  ChevronRight, AlertTriangle, CheckCircle2, Megaphone, CalendarClock,
} from 'lucide-react';
import { RadialBarChart, RadialBar, PolarAngleAxis } from 'recharts';
import api from '../../../services/api';
import { useAuthStore, selectToken } from '../../../stores/authStore';
import { usePermission } from '../../../hooks/usePermission';

// ─── Types (matching backend schemas) ────────────────────────────────────────

interface UserBasic { full_name: string; email: string }

interface StudentProfile {
  student_id: number;
  usn: string;
  program_id: number;
  batch_id: number;
  section_id: number | null;
  current_semester_number: number | null;
  cgpa: number | null;
  status: string;
  user: UserBasic;
}

interface AttendanceSummary {
  offering_id: number;
  subject_code: string;
  subject_name: string;
  total_sessions: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
  sessions: unknown[];
}

interface AssessmentMark {
  assessment_id: number;
  title: string;
  max_marks: number;
  marks_obtained: number | null;
  is_absent: boolean;
  status: string;
  percentage: number | null;
}

interface SubjectMarksRow {
  subject_name: string;
  subject_code: string;
  assessments: AssessmentMark[];
}

interface MentoringSession {
  session_id: number;
  session_date: string;
  session_time: string | null;
  topics_discussed: string | null;
  action_items: string | null;
  follow_up_required: boolean;
  follow_up_date: string | null;
  assignment_id: number;
  created_by: number;
}

interface Announcement {
  announcement_id: number;
  title: string;
  body: string;
  category: string;
  priority: string;
  posted_at: string;
  expiry_date: string | null;
  author_name: string;
  is_read?: boolean;
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm animate-pulse">
      <div className="h-3 w-20 bg-gray-200 rounded mb-4" />
      <div className="h-8 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-2 w-full bg-gray-100 rounded-full" />
    </div>
  );
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-lg flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 bg-gray-200 rounded" />
            <div className="h-2 w-1/2 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Shared Sub-components ───────────────────────────────────────────────────

function StatsCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string | number;
  sub?: React.ReactNode;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">{label}</p>
        <p className={`text-3xl font-black leading-none ${color}`}>{value}</p>
        {sub && <div className="mt-2">{sub}</div>}
      </div>
      <div className="p-2.5 rounded-xl bg-gray-50">{icon}</div>
    </div>
  );
}

function AttendanceRing({ pct }: { pct: number }) {
  const fill = pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
  const data = [{ value: pct, fill }];

  return (
    <RadialBarChart
      width={68} height={68}
      innerRadius={24} outerRadius={32}
      data={data}
      startAngle={90} endAngle={-270}
      barSize={7}
    >
      <PolarAngleAxis type="number" domain={[0, 100]} tick={false} angleAxisId={0} />
      <RadialBar background dataKey="value" cornerRadius={4} />
      <text x={34} y={38} textAnchor="middle" fontSize={13} fontWeight={800} fill="#111827">
        {Math.round(pct)}%
      </text>
    </RadialBarChart>
  );
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'PUBLISHED'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : 'bg-gray-50 text-gray-500 border-gray-200';
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${cls}`}>
      {status}
    </span>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function StudentDashboardPage() {
  const token = useAuthStore(selectToken);
  const canViewAttendance = usePermission('ATTENDANCE_VIEW_OWN');
  const canViewMarks = usePermission('MARKS_VIEW_OWN');
  const canViewAnnouncements = !!token;

  // 1. Student profile
  const { data: student, isLoading: studentLoading } = useQuery<StudentProfile>({
    queryKey: ['student-me'],
    queryFn: () => api.get('/students/me').then(r => r.data),
    staleTime: 5 * 60_000,
  });

  // 2. Attendance summary
  const { data: attendance, isLoading: attLoading } = useQuery<AttendanceSummary[]>({
    queryKey: ['attendance-summary'],
    queryFn: () => api.get('/students/me/attendance-summary').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: canViewAttendance,
  });

  // 3. Marks
  const { data: marks, isLoading: marksLoading } = useQuery<SubjectMarksRow[]>({
    queryKey: ['student-marks'],
    queryFn: () => api.get('/students/me/marks').then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: canViewMarks,
  });

  // 4. Mentor sessions (404 is expected if no assignment)
  const { data: mentorSessions } = useQuery<MentoringSession[]>({
    queryKey: ['mentor-sessions'],
    queryFn: () => api.get('/mentor/my-sessions').then(r => r.data),
    staleTime: 10 * 60_000,
    retry: false,
  });

  // 5. Announcements
  const { data: announcements } = useQuery<Announcement[]>({
    queryKey: ['announcements', { limit: 3, preview: true }],
    queryFn: () => api.get('/announcements', { params: { limit: 3 } }).then(r => r.data),
    staleTime: 5 * 60_000,
    enabled: canViewAnnouncements,
  });

  // ── Derived values ──

  const firstName = student?.user.full_name?.split(' ')[0] ?? 'Student';
  const cgpa = student?.cgpa != null ? Number(student.cgpa) : null;
  const cgpaColor =
    cgpa == null ? 'text-gray-400'
      : cgpa >= 7.5 ? 'text-emerald-600'
        : cgpa >= 5.5 ? 'text-amber-600'
          : 'text-red-600';

  const overallPct =
    attendance && attendance.length > 0
      ? Math.round(attendance.reduce((s, a) => s + a.percentage, 0) / attendance.length)
      : null;

  const enrolledCount = attendance?.length ?? 0;

  // Flatten and take last 3 assessments
  const recentMarks =
    marks
      ?.flatMap(subj =>
        subj.assessments
          .filter(a => a.status === 'PUBLISHED')
          .map(a => ({ ...a, subject_name: subj.subject_name })),
      )
      .slice(-3)
      .reverse() ?? [];

  // Subjects below 75%
  const lowAttendance = attendance?.filter(a => a.percentage < 75) ?? [];

  // Next follow-up from mentor sessions
  const today = new Date().toISOString().slice(0, 10);
  const nextFollowUp = mentorSessions
    ?.filter(s => s.follow_up_date && s.follow_up_date >= today)
    .sort((a, b) => a.follow_up_date!.localeCompare(b.follow_up_date!))[0] ?? null;

  const latestSession = mentorSessions
    ? [...mentorSessions].sort(
        (a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime(),
      )[0]
    : null;

  // ── Render ──

  return (
    <div className="space-y-6 pb-8">

      {/* ── Welcome Header ── */}
      {studentLoading ? (
        <div className="animate-pulse space-y-2">
          <div className="h-8 w-64 bg-gray-200 rounded" />
          <div className="h-4 w-48 bg-gray-100 rounded" />
        </div>
      ) : (
        <div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            Welcome back, {firstName}!
          </h1>
          <p className="text-gray-500 mt-1 font-medium">
            Semester {student?.current_semester_number ?? '—'} &middot; {student?.usn}
          </p>
        </div>
      )}

      {/* ── A) Top Stats Bar ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {studentLoading || attLoading ? (
          Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatsCard
              label="CGPA"
              value={cgpa != null ? cgpa.toFixed(2) : '—'}
              color={cgpaColor}
              icon={<GraduationCap className="w-5 h-5 text-gray-400" />}
              sub={
                cgpa != null && (
                  <span className={`text-xs font-bold ${cgpaColor}`}>
                    {cgpa >= 7.5 ? 'Good standing' : cgpa >= 5.5 ? 'Warning zone' : 'At risk'}
                  </span>
                )
              }
            />

            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm flex items-start justify-between">
              <div>
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">
                  Attendance
                </p>
                <p className={`text-3xl font-black leading-none ${
                  overallPct == null ? 'text-gray-400'
                    : overallPct >= 75 ? 'text-emerald-600'
                      : 'text-amber-600'
                }`}>
                  {overallPct != null ? `${overallPct}%` : '—'}
                </p>
                <span className={`text-xs font-bold mt-2 inline-block ${
                  overallPct != null && overallPct >= 75 ? 'text-emerald-500' : 'text-amber-500'
                }`}>
                  {overallPct != null && overallPct >= 75 ? '✓ Above threshold' : '⚠ Below 75%'}
                </span>
              </div>
              {overallPct != null && <AttendanceRing pct={overallPct} />}
            </div>

            <StatsCard
              label="Subjects"
              value={enrolledCount}
              color="text-gray-900"
              icon={<BookOpen className="w-5 h-5 text-gray-400" />}
              sub={<span className="text-xs font-semibold text-gray-400">Enrolled this term</span>}
            />

            <StatsCard
              label="Notifications"
              value={0}
              color="text-gray-900"
              icon={<Bell className="w-5 h-5 text-gray-400" />}
              sub={<span className="text-xs font-semibold text-gray-400">All caught up</span>}
            />
          </>
        )}
      </div>

      {/* ── Row 2: Recent Marks + Mentor Info ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* C) Recent Marks */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-base font-extrabold text-gray-900">Recent Marks</h2>
            <Link
              to="/student/performance"
              className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-0.5"
            >
              View Full Performance <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {marksLoading ? (
            <ListSkeleton rows={3} />
          ) : recentMarks.length === 0 ? (
            <p className="text-sm text-gray-400 font-medium py-6 text-center">
              No published marks yet
            </p>
          ) : (
            <div className="space-y-3">
              {recentMarks.map(m => (
                <div
                  key={`${m.subject_name}-${m.assessment_id}`}
                  className="flex items-center justify-between p-3 rounded-xl bg-gray-50/60 border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <BookOpen className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{m.title}</p>
                      <p className="text-xs text-gray-400 font-medium">
                        {m.subject_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-extrabold text-gray-900">
                      {m.marks_obtained != null ? m.marks_obtained : '—'}/{m.max_marks}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* B) Mentor Info Card */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-gray-900">Your Mentor</h2>
            <Link
              to="/student/mentor-notes"
              className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-0.5"
            >
              View All Notes <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!mentorSessions || mentorSessions.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400 font-medium text-center">
                No mentor sessions yet
              </p>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {latestSession && (
                <div className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 space-y-2">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                    Last Session
                  </p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(latestSession.session_date).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </p>
                  {latestSession.topics_discussed && (
                    <p className="text-xs text-gray-500 line-clamp-2">
                      {latestSession.topics_discussed}
                    </p>
                  )}
                </div>
              )}

              {nextFollowUp && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 flex items-start gap-2.5">
                  <CalendarClock className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-700">Upcoming Follow-up</p>
                    <p className="text-sm font-semibold text-amber-900">
                      {new Date(nextFollowUp.follow_up_date!).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                      })}
                    </p>
                  </div>
                </div>
              )}

              {latestSession?.action_items && (
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">
                    Action Items
                  </p>
                  <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                    {latestSession.action_items}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Row 3: Attendance Alerts + Announcements ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* D) Attendance Alerts */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <h2 className="text-base font-extrabold text-gray-900 mb-4">Attendance Alerts</h2>

          {attLoading ? (
            <ListSkeleton rows={2} />
          ) : lowAttendance.length === 0 ? (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-50/60 border border-emerald-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-emerald-700">
                All subjects above 75% — keep it up!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {lowAttendance.map(a => {
                const effective = a.present + a.late;
                const needed = Math.ceil((0.75 * a.total_sessions - effective) / 0.25);
                return (
                  <div
                    key={a.offering_id}
                    className="flex items-center justify-between p-3.5 rounded-xl bg-red-50/50 border border-red-200"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {a.subject_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {a.present + a.late}/{a.total_sessions} sessions attended
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-black text-red-600">
                        {Math.round(a.percentage)}%
                      </p>
                      {needed > 0 && (
                        <p className="text-[10px] font-bold text-red-500">
                          {needed} more needed
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* E) Announcements Strip */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-gray-900">Announcements</h2>
            <Link
              to="/student/announcements"
              className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-0.5"
            >
              View All <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!announcements || announcements.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-gray-400 font-medium">No announcements</p>
            </div>
          ) : (
            <div className="space-y-3 flex-1">
              {announcements.map(a => (
                <div
                  key={a.announcement_id}
                  className="p-3.5 rounded-xl bg-gray-50/60 border border-gray-100 space-y-1"
                >
                  <div className="flex items-center gap-2">
                    <Megaphone className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
                      {a.category}
                    </span>
                    {a.priority === 'HIGH' && (
                      <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-600 text-[10px] font-bold">
                        URGENT
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-gray-900 line-clamp-1">{a.title}</p>
                  <p className="text-xs text-gray-400 font-medium">
                    {new Date(a.posted_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short',
                    })}
                    {' · '}{a.author_name}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
