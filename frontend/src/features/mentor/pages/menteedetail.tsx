import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, BarChart, Bar
} from 'recharts';
import {
  ArrowLeft, GraduationCap, Calendar, BookOpen, Star,
  TrendingUp, TrendingDown, Search, Bell, Settings,
  ClipboardList, Plus, CheckCircle, AlertTriangle, Clock,
  FileText, ChevronRight
} from 'lucide-react';
import api from '../../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface StudentProfile {
  id: number;
  name: string;
  usn: string;
  photo_url?: string;
  program: string;
  batch: string;
  semester: number;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  attendance_percent: number;
  cgpa: number;
  sgpa: number;
  sgpa_delta: number;
  university_rank: number;
  credits_earned: number;
  total_credits: number;
}

interface Enrollment {
  id: number;
  offering_id: number;
  subject_name: string;
  subject_code: string;
  credits: number;
  semester: number;
  attendance_percent: number;
  internal_marks: number;
  max_internal_marks: number;
  grade: string;
  grade_points: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'CRITICAL';
}

interface AttendanceSession {
  id: number;
  date: string;
  is_present: boolean;
  topic?: string;
}

interface MentorSession {
  id: number;
  mentor_name: string;
  mentor_photo?: string;
  session_type: string;
  notes: string;
  date: string;
  follow_up_required: boolean;
}

type Tab = 'overview' | 'attendance' | 'marks' | 'notes';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

function Avatar({ name, photo, size = 'lg' }: { name: string; photo?: string; size?: 'sm' | 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-16 h-16 text-2xl' : size === 'md' ? 'w-10 h-10 text-sm' : 'w-8 h-8 text-xs';
  if (photo) return <img src={photo} alt={name} className={`${dim} rounded-full object-cover`} />;
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className={`${dim} bg-violet-100 text-violet-600 rounded-full flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  );
}

function StatusBadge({ status }: { status: StudentProfile['status'] }) {
  const map = {
    ACTIVE: 'bg-green-100 text-green-700',
    INACTIVE: 'bg-gray-100 text-gray-500',
    SUSPENDED: 'bg-red-100 text-red-600',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${map[status]}`}>
      {status}
    </span>
  );
}

function SubjectStatusBadge({ status }: { status: Enrollment['status'] }) {
  const map = {
    ON_TRACK: 'bg-emerald-100 text-emerald-700',
    AT_RISK: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-600',
  };
  const label = { ON_TRACK: 'ON TRACK', AT_RISK: 'AT RISK', CRITICAL: 'CRITICAL' };
  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold tracking-wide ${map[status]}`}>
      {label[status]}
    </span>
  );
}

function AttendanceBar({ value, showLabel = true }: { value: number; showLabel?: boolean }) {
  const color = value >= 85 ? 'bg-green-500' : value >= 75 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 min-w-[60px] overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      {showLabel && (
        <span className={`text-xs font-bold w-8 text-right ${value < 75 ? 'text-red-500' : 'text-gray-700'}`}>
          {value}%
        </span>
      )}
    </div>
  );
}

function gradeColor(grade: string) {
  if (['A+', 'A'].includes(grade)) return 'text-green-600';
  if (['A-', 'B+'].includes(grade)) return 'text-blue-600';
  if (['B', 'B-'].includes(grade)) return 'text-purple-600';
  return 'text-orange-600';
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-sm">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="font-bold text-violet-600">{payload[0].value.toFixed(2)} SGPA</p>
    </div>
  );
}

// ─── Overview Tab ────────────────────────────────────────────────────────────

function OverviewTab({ student, enrollments }: { student: StudentProfile; enrollments: Enrollment[] }) {
  // Build CGPA trend from enrollments grouped by semester
  const semMap = new Map<number, Enrollment[]>();
  for (const e of enrollments) {
    if (!semMap.has(e.semester)) semMap.set(e.semester, []);
    semMap.get(e.semester)!.push(e);
  }
  const trendData = Array.from(semMap.entries())
    .sort(([a], [b]) => a - b)
    .map(([sem, subjects]) => {
      const tc = subjects.reduce((s, e) => s + e.credits, 0);
      const ws = subjects.reduce((s, e) => s + e.grade_points * e.credits, 0);
      const sgpa = tc > 0 ? parseFloat((ws / tc).toFixed(2)) : 0;
      return { name: `SEM ${sem} (${sgpa})`, sgpa };
    });

  const attendanceLabel = student.attendance_percent >= 85 ? 'Good' : student.attendance_percent >= 75 ? 'Fair' : 'Low';
  const attendanceLabelColor = student.attendance_percent >= 85 ? 'text-green-600 bg-green-50' : student.attendance_percent >= 75 ? 'text-orange-600 bg-orange-50' : 'text-red-600 bg-red-50';

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Attendance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Attendance</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-900">{student.attendance_percent}%</span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full mb-1 ${attendanceLabelColor}`}>
              {attendanceLabel}
            </span>
          </div>
          <AttendanceBar value={student.attendance_percent} showLabel={false} />
        </div>

        {/* Current SGPA */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Current SGPA</p>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold text-gray-900">{student.sgpa.toFixed(2)}</span>
            <span className={`text-xs font-semibold flex items-center gap-0.5 mb-1 ${student.sgpa_delta >= 0 ? 'text-green-600' : 'text-red-500'}`}>
              {student.sgpa_delta >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
              {Math.abs(student.sgpa_delta).toFixed(1)}
            </span>
          </div>
          <p className="text-xs text-gray-400 mt-1">Last updated: 2 days ago</p>
        </div>

        {/* Cumulative CGPA */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Cumulative CGPA</p>
          <span className="text-3xl font-bold text-gray-900">{student.cgpa.toFixed(2)}</span>
          <p className="text-xs text-gray-400 mt-1.5">University Rank: #{student.university_rank}</p>
        </div>

        {/* Enrolled Subjects */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-2">Enrolled Subjects</p>
          <span className="text-3xl font-bold text-gray-900">{enrollments.filter(e => e.semester === student.semester).length}</span>
          <p className="text-xs text-gray-400 mt-1.5">Current Semester {student.semester}</p>
        </div>
      </div>

      {/* Chart + Subject Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* SGPA Trend */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-start justify-between mb-1">
            <div>
              <h3 className="font-bold text-gray-900">Academic Performance Trend</h3>
              <p className="text-xs text-gray-400 mt-0.5">GPA Growth analysis from Sem 1 to Sem {student.semester}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-violet-600 font-semibold">
              <span className="w-2.5 h-2.5 rounded-full bg-violet-500 inline-block" />
              SGPA
            </div>
          </div>
          {trendData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-gray-300 text-sm">No data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="sgpaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 10]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="sgpa" stroke="#7c3aed" strokeWidth={2.5}
                  fill="url(#sgpaGrad)"
                  dot={{ fill: '#7c3aed', strokeWidth: 2, r: 5, stroke: '#fff' }}
                  activeDot={{ r: 7 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Subject summary */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-bold text-gray-900 mb-4">Subject Performance</h3>
          <div className="space-y-3">
            {enrollments.filter(e => e.semester === student.semester).slice(0, 4).map(e => (
              <div key={e.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                  <BookOpen size={13} className="text-violet-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{e.subject_name}</p>
                  <AttendanceBar value={e.attendance_percent} />
                </div>
                <span className={`text-sm font-bold ${gradeColor(e.grade)}`}>{e.grade}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Attendance Tab ───────────────────────────────────────────────────────────

function AttendanceTab({ enrollments, assignmentId }: { enrollments: Enrollment[]; assignmentId?: number }) {
  const [selectedSubject, setSelectedSubject] = useState<Enrollment | null>(null);

  const { data: sessions = [], isLoading } = useQuery<AttendanceSession[]>({
    queryKey: ['attendance-sessions', selectedSubject?.offering_id],
    queryFn: () => api.get(`/attendance/offerings/${selectedSubject!.offering_id}/sessions`).then(r => r.data),
    enabled: !!selectedSubject,
  });

  const presentCount = sessions.filter(s => s.is_present).length;
  const absentCount = sessions.length - presentCount;

  return (
    <div className="space-y-4">
      {/* Subject overview table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Subject-wise Attendance</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50/60">
              <th className="px-5 py-3 text-left">Subject</th>
              <th className="px-3 py-3 text-center">Classes</th>
              <th className="px-3 py-3 text-center w-48">Attendance</th>
              <th className="px-3 py-3 text-center">Status</th>
              <th className="px-3 py-3 text-center">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {enrollments.map(e => (
              <tr key={e.id} className={`hover:bg-gray-50/50 transition ${selectedSubject?.id === e.id ? 'bg-violet-50/40' : ''}`}>
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-gray-800">{e.subject_name}</p>
                  <p className="text-xs text-gray-400">{e.subject_code}</p>
                </td>
                <td className="px-3 py-3.5 text-center text-gray-500 text-xs">—</td>
                <td className="px-3 py-3.5">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full ${e.attendance_percent >= 85 ? 'bg-green-500' : e.attendance_percent >= 75 ? 'bg-yellow-400' : 'bg-red-500'}`}
                        style={{ width: `${e.attendance_percent}%` }}
                      />
                    </div>
                    <span className={`text-xs font-bold w-8 text-right ${e.attendance_percent < 75 ? 'text-red-500' : 'text-gray-700'}`}>
                      {e.attendance_percent}%
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3.5 text-center">
                  <SubjectStatusBadge status={e.status} />
                </td>
                <td className="px-3 py-3.5 text-center">
                  <button
                    onClick={() => setSelectedSubject(selectedSubject?.id === e.id ? null : e)}
                    className={`text-xs font-semibold px-2 py-1 rounded-lg transition ${selectedSubject?.id === e.id ? 'bg-violet-600 text-white' : 'text-violet-600 hover:bg-violet-50'}`}
                  >
                    {selectedSubject?.id === e.id ? 'Hide' : 'View'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Session detail */}
      {selectedSubject && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-bold text-gray-900">{selectedSubject.subject_name} — Session Log</h3>
              <p className="text-xs text-gray-400 mt-0.5">{selectedSubject.subject_code}</p>
            </div>
            <div className="flex gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle size={12} />{presentCount} Present</span>
              <span className="flex items-center gap-1 text-red-500"><AlertTriangle size={12} />{absentCount} Absent</span>
            </div>
          </div>
          {isLoading ? (
            <div className="grid grid-cols-7 gap-2">
              {Array.from({ length: 14 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No sessions recorded.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {sessions.map((s, idx) => (
                <div key={s.id} className={`rounded-xl p-2.5 text-center border ${s.is_present ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
                  <div className={`w-5 h-5 rounded-full mx-auto mb-1 flex items-center justify-center ${s.is_present ? 'bg-green-500' : 'bg-red-400'}`}>
                    {s.is_present ? <CheckCircle size={12} className="text-white" /> : <span className="text-white text-xs font-bold">A</span>}
                  </div>
                  <p className="text-[10px] font-semibold text-gray-600">Class {idx + 1}</p>
                  <p className="text-[9px] text-gray-400">
                    {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Marks Tab ───────────────────────────────────────────────────────────────

function MarksTab({ enrollments }: { enrollments: Enrollment[] }) {
  const chartData = enrollments.map(e => ({
    name: e.subject_code,
    score: e.max_internal_marks > 0 ? Math.round((e.internal_marks / e.max_internal_marks) * 100) : 0,
    grade: e.grade,
  }));

  return (
    <div className="space-y-5">
      {/* Bar chart overview */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-bold text-gray-900 mb-1">Marks Overview</h3>
        <p className="text-xs text-gray-400 mb-4">Internal marks percentage per subject</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 0, right: 10, left: -25, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f5f5f5" />
            <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v: number) => [`${v}%`, 'Score']} />
            <Bar dataKey="score" fill="#7c3aed" radius={[4, 4, 0, 0]} opacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detailed table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900">Subject Performance</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50/60">
              <th className="px-5 py-3 text-left">Subject Name</th>
              <th className="px-3 py-3 text-center">Attendance</th>
              <th className="px-3 py-3 text-center">Internal Marks</th>
              <th className="px-3 py-3 text-center">Grade</th>
              <th className="px-3 py-3 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {enrollments.map(e => (
              <tr key={e.id} className="hover:bg-gray-50/50 transition">
                <td className="px-5 py-3.5">
                  <p className="font-semibold text-gray-800">{e.subject_name}</p>
                  <p className="text-xs text-gray-400">Subject Code: {e.subject_code}</p>
                </td>
                <td className="px-3 py-3.5 text-center text-sm font-semibold text-gray-700">
                  {e.attendance_percent}%
                </td>
                <td className="px-3 py-3.5 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-sm font-bold text-gray-800">{e.internal_marks} / {e.max_internal_marks}</span>
                    <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-1.5 rounded-full ${e.internal_marks / e.max_internal_marks >= 0.8 ? 'bg-green-500' : e.internal_marks / e.max_internal_marks >= 0.6 ? 'bg-blue-500' : 'bg-orange-400'}`}
                        style={{ width: `${(e.internal_marks / e.max_internal_marks) * 100}%` }}
                      />
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3.5 text-center">
                  <span className={`text-lg font-bold ${gradeColor(e.grade)}`}>{e.grade}</span>
                </td>
                <td className="px-3 py-3.5 text-center">
                  <SubjectStatusBadge status={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Notes Tab ───────────────────────────────────────────────────────────────

function NotesTab({ sessions }: { sessions: MentorSession[] }) {
  if (sessions.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
        <ClipboardList size={28} className="text-gray-200 mx-auto mb-2" />
        <p className="text-sm text-gray-400">No mentor notes recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-gray-900">Mentor Notes History</h3>
        <button className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 transition">
          View All <ChevronRight size={13} />
        </button>
      </div>
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-gray-100" />
        <div className="space-y-4">
          {sessions.map(s => (
            <div key={s.id} className="relative pl-14">
              {/* Dot */}
              <div className="absolute left-3 top-3 w-5 h-5 rounded-full bg-white border-2 border-violet-400 z-10 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-violet-500" />
              </div>

              <div className={`bg-white rounded-2xl border shadow-sm p-4 ${s.follow_up_required ? 'border-orange-200' : 'border-gray-100'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={s.mentor_name} photo={s.mentor_photo} size="sm" />
                    <div>
                      <p className="text-sm font-bold text-gray-800">{s.mentor_name}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-semibold bg-violet-50 text-violet-600 px-2 py-0.5 rounded-full">
                      {s.session_type}
                    </span>
                    {s.follow_up_required && (
                      <span className="text-[10px] font-semibold bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Clock size={9} /> Follow-up
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-sm text-gray-600 mt-3 leading-relaxed italic">"{s.notes}"</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MenteeDetail() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [showNoteModal, setShowNoteModal] = useState(false);

  const id = Number(studentId);

  const { data: student, isLoading: sLoading } = useQuery<StudentProfile>({
    queryKey: ['student', id],
    queryFn: () => api.get(`/students/${id}`).then(r => r.data),
    enabled: !!id,
  });

  const { data: enrollments = [], isLoading: eLoading } = useQuery<Enrollment[]>({
    queryKey: ['student-enrollments', id],
    queryFn: () => api.get(`/students/${id}/enrollments`).then(r => r.data),
    enabled: !!id,
  });

  // Get assignment ID for this student
  const { data: assignments = [] } = useQuery<{ id: number; student_id: number }[]>({
    queryKey: ['mentor-assignments-detail'],
    queryFn: () => api.get('/mentor/assignments').then(r => r.data),
  });
  const assignment = assignments.find(a => a.student_id === id);

  const { data: sessions = [] } = useQuery<MentorSession[]>({
    queryKey: ['mentor-student-sessions', assignment?.id],
    queryFn: () => api.get(`/mentor/assignments/${assignment!.id}/sessions`).then(r => r.data),
    enabled: !!assignment,
  });

  const isLoading = sLoading || eLoading;

  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overview', label: 'Overview', icon: <Star size={14} /> },
    { key: 'attendance', label: 'Attendance', icon: <Calendar size={14} /> },
    { key: 'marks', label: 'Marks', icon: <TrendingUp size={14} /> },
    { key: 'notes', label: 'Notes', icon: <FileText size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-display">

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex-1 max-w-xs">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search student by name or ID..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><Bell size={16} /></button>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><Settings size={16} /></button>
          <div className="flex items-center gap-2 pl-2 border-l border-gray-100">
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold text-gray-800">Dr. Smith</p>
              <p className="text-[10px] text-gray-400">Senior Mentor</p>
            </div>
            <div className="w-8 h-8 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-xs font-bold">DS</div>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-screen-xl mx-auto">

        {/* Back */}
        <button
          onClick={() => navigate('/mentor/mentees')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition font-medium"
        >
          <ArrowLeft size={15} /> Back to Mentee List
        </button>

        {/* Student Profile Card */}
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : student ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex flex-wrap items-start gap-5">
              <Avatar name={student.name} photo={student.photo_url} size="lg" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-xl font-bold text-gray-900">{student.name}</h1>
                  <StatusBadge status={student.status} />
                </div>
                <p className="text-sm text-gray-500 mt-0.5">Student ID: <span className="font-semibold text-gray-700">{student.usn}</span></p>
                <div className="flex items-center flex-wrap gap-4 mt-2">
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <GraduationCap size={13} className="text-violet-400" />
                    {student.program}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <Calendar size={13} className="text-violet-400" />
                    Batch {student.batch}
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-gray-500">
                    <BookOpen size={13} className="text-violet-400" />
                    Semester {student.semester}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3 shrink-0">
                <div className="text-right">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Current CGPA</p>
                  <p className="text-3xl font-bold text-primary">{student.cgpa.toFixed(2)}</p>
                </div>
                <button
                  onClick={() => setShowNoteModal(true)}
                  className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition"
                >
                  <Plus size={14} />
                  Add Mentor Note
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-white rounded-xl border border-gray-100 shadow-sm p-1 w-fit">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                activeTab === tab.key
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-28" />)}</div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : student ? (
          <>
            {activeTab === 'overview' && <OverviewTab student={student} enrollments={enrollments} />}
            {activeTab === 'attendance' && <AttendanceTab enrollments={enrollments} assignmentId={assignment?.id} />}
            {activeTab === 'marks' && <MarksTab enrollments={enrollments} />}
            {activeTab === 'notes' && <NotesTab sessions={sessions} />}
          </>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
            <p className="text-gray-400">Student not found.</p>
          </div>
        )}
      </div>

      {/* Add Note Modal */}
      {showNoteModal && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={() => setShowNoteModal(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
              <h3 className="font-bold text-gray-900 text-lg mb-4">Add Mentor Note</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Session Type</label>
                  <select className="w-full mt-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400">
                    <option>Academic Review</option>
                    <option>Career Guidance</option>
                    <option>Personal Support</option>
                    <option>General Check-in</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
                  <textarea
                    rows={4}
                    placeholder="Write your session notes here..."
                    className="w-full mt-1 px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" className="rounded accent-violet-600" />
                  <span className="text-sm text-gray-600">Requires follow-up</span>
                </label>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setShowNoteModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold transition shadow-sm"
                >
                  Save Note
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
