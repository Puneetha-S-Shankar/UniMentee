import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight,
  BookCopy, CalendarCheck, Star
} from 'lucide-react';
import api from '../../../services/api';
import { useAuthStore } from '../../../stores/authStore';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Enrollment {
  id: number;
  offering_id: number;
  subject_name: string;
  subject_code: string;
  credits: number;
  semester: number;
  semester_label?: string;
  faculty_name: string;
  attendance_percent: number;
  internal_marks: number;
  max_internal_marks: number;
  assignment_marks: number;
  max_assignment_marks: number;
  grade: string;
  grade_points: number;
  status: 'ON_TRACK' | 'NEEDS_IMPROVEMENT' | 'AT_RISK' | 'COMPLETED';
}

interface Assessment {
  id: number;
  name: string;
  assessment_type: 'INTERNAL' | 'EXTERNAL' | 'ASSIGNMENT' | 'QUIZ' | 'LAB';
  max_marks: number;
  marks_obtained: number;
  date: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function attendanceBarColor(pct: number) {
  if (pct >= 85) return 'bg-green-500';
  if (pct >= 75) return 'bg-yellow-400';
  return 'bg-red-500';
}

function statusConfig(s: Enrollment['status']) {
  const map = {
    ON_TRACK:          { label: '+ ON TRACK',          cls: 'bg-green-100 text-green-700' },
    NEEDS_IMPROVEMENT: { label: '• NEEDS IMPROVEMENT',  cls: 'bg-yellow-100 text-yellow-700' },
    AT_RISK:           { label: '+ AT RISK',            cls: 'bg-red-100 text-red-600' },
    COMPLETED:         { label: '✓ COMPLETED',          cls: 'bg-gray-100 text-gray-500' },
  };
  return map[s] ?? map.ON_TRACK;
}

function gradeColor(grade: string) {
  if (['A+', 'A'].includes(grade)) return 'text-green-600';
  if (['A-', 'B+'].includes(grade)) return 'text-blue-600';
  if (['B', 'B-'].includes(grade)) return 'text-violet-600';
  if (['C+', 'C'].includes(grade)) return 'text-orange-500';
  return 'text-red-500';
}

function assessmentTypeBadge(t: Assessment['assessment_type']) {
  const map: Record<string, string> = {
    INTERNAL:   'bg-blue-100 text-blue-700',
    EXTERNAL:   'bg-purple-100 text-purple-700',
    ASSIGNMENT: 'bg-green-100 text-green-700',
    QUIZ:       'bg-orange-100 text-orange-700',
    LAB:        'bg-teal-100 text-teal-700',
  };
  return map[t] ?? 'bg-gray-100 text-gray-600';
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

const PAGE_SIZE = 10;

// ─── Attendance Bar ───────────────────────────────────────────────────────────

function AttendanceBar({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div
          className={`h-1.5 rounded-full transition-all ${attendanceBarColor(value)}`}
          style={{ width: `${value}%` }}
        />
      </div>
      <span className={`text-xs font-bold tabular-nums ${value < 75 ? 'text-red-500' : 'text-gray-600'}`}>
        {value}%
      </span>
    </div>
  );
}

// ─── Assessment Breakdown ─────────────────────────────────────────────────────

function AssessmentBreakdown({ offeringId }: { offeringId: number }) {
  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ['assessments', offeringId],
    queryFn: () => api.get(`/marks/offerings/${offeringId}/assessments`).then(r => r.data),
  });

  return (
    <tr>
      <td colSpan={7} className="p-0">
        <div className="bg-gray-50/80 border-t border-dashed border-gray-200 px-8 py-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
            Assessment Breakdown
          </p>

          {isLoading ? (
            <div className="flex gap-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-40 rounded-xl" />)}
            </div>
          ) : assessments.length === 0 ? (
            <p className="text-xs text-gray-400 py-2">No assessments recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2.5">
              {assessments.map(a => {
                const pct = a.max_marks > 0 ? Math.round((a.marks_obtained / a.max_marks) * 100) : 0;
                const barColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-orange-400';
                const scoreColor = pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : 'text-orange-500';
                return (
                  <div key={a.id} className="bg-white border border-gray-100 rounded-xl px-4 py-3 min-w-[150px] shadow-sm">
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${assessmentTypeBadge(a.assessment_type)}`}>
                        {a.assessment_type}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-800 leading-snug">{a.name}</p>
                    <div className="flex items-end justify-between mt-2">
                      <span className="text-base font-bold text-gray-900">
                        {a.marks_obtained}
                        <span className="text-xs text-gray-400 font-normal">/{a.max_marks}</span>
                      </span>
                      <span className={`text-xs font-bold ${scoreColor}`}>{pct}%</span>
                    </div>
                    <div className="mt-1.5 bg-gray-100 rounded-full h-1 overflow-hidden">
                      <div className={`h-1 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Subjects() {
  const userId = useAuthStore((s) => s.user?.user_id);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [selectedSemKey, setSelectedSemKey] = useState<string>('');

  const { data: enrollments = [], isLoading } = useQuery<Enrollment[]>({
    queryKey: ['student-enrollments', userId],
    queryFn: () => api.get(`/students/${userId}/enrollments`).then(r => r.data),
    enabled: !!userId,
  });

  // Build sorted semester list (latest first)
  const semesters = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of enrollments) {
      const key = String(e.semester);
      map.set(key, e.semester_label ?? `Fall Semester ${e.semester}`);
    }
    return Array.from(map.entries()).sort(([a], [b]) => Number(b) - Number(a));
  }, [enrollments]);

  // Default to latest semester once data loads
  const activeSemKey = selectedSemKey || semesters[0]?.[0] || '';

  const filtered = useMemo(
    () => activeSemKey
      ? enrollments.filter(e => String(e.semester) === activeSemKey)
      : enrollments,
    [enrollments, activeSemKey]
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Summary stats
  const avgAttendance = filtered.length
    ? Math.round(filtered.reduce((s, e) => s + e.attendance_percent, 0) / filtered.length)
    : 0;
  const avgGP = filtered.length
    ? filtered.reduce((s, e) => s + e.grade_points, 0) / filtered.length
    : 0;
  const avgGradeLetter =
    avgGP >= 9 ? 'A+' : avgGP >= 8.5 ? 'A' : avgGP >= 8 ? 'A-' :
    avgGP >= 7.5 ? 'B+' : avgGP >= 7 ? 'B' : avgGP >= 6 ? 'B-' : 'C';

  const activeSemLabel = semesters.find(([k]) => k === activeSemKey)?.[1] ?? '';

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-display">
      <div className="p-6 space-y-5 max-w-screen-lg mx-auto">

        {/* Header Row */}
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Subject Details</h1>
            <p className="text-sm text-gray-400 mt-0.5">
              Review your academic performance across all enrolled subjects.
            </p>
          </div>

          {/* Semester Selector */}
          <div className="flex flex-col items-end">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-1">Semester</p>
            <div className="relative">
              <select
                value={activeSemKey}
                onChange={e => {
                  setSelectedSemKey(e.target.value);
                  setPage(1);
                  setExpandedId(null);
                }}
                className="appearance-none bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-semibold text-gray-700 pl-3 pr-8 py-2 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
              >
                {semesters.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: <BookCopy size={18} className="text-blue-500" />, bg: 'bg-blue-50', label: 'Total Subjects', value: String(filtered.length).padStart(2, '0') },
            { icon: <CalendarCheck size={18} className="text-green-500" />, bg: 'bg-green-50', label: 'Avg. Attendance', value: `${avgAttendance}%` },
            { icon: <Star size={18} className="text-yellow-500" />, bg: 'bg-yellow-50', label: 'Average Grade', value: avgGradeLetter },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.bg} shrink-0`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium leading-tight">{stat.label}</p>
                {isLoading
                  ? <Skeleton className="h-7 w-12 mt-1" />
                  : <p className="text-2xl font-bold text-gray-900 leading-tight">{stat.value}</p>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] font-bold uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3.5 text-left">Subject Name</th>
                <th className="px-3 py-3.5 text-left">Code</th>
                <th className="px-3 py-3.5 text-left">Attendance</th>
                <th className="px-3 py-3.5 text-center">Internals</th>
                <th className="px-3 py-3.5 text-center">Assignment</th>
                <th className="px-3 py-3.5 text-center">Grade</th>
                <th className="px-3 py-3.5 text-center">Status</th>
              </tr>
            </thead>

            <tbody>
              {isLoading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50">
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <Skeleton className="h-4 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : paginated.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <BookCopy size={28} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No subjects found for this semester.</p>
                    </td>
                  </tr>
                )
                : paginated.map((e, idx) => {
                    const isExpanded = expandedId === e.id;
                    const isLast = idx === paginated.length - 1;
                    const sc = statusConfig(e.status);

                    return (
                      <>
                        <tr
                          key={e.id}
                          onClick={() => setExpandedId(isExpanded ? null : e.id)}
                          className={`cursor-pointer transition-colors group
                            ${!isLast || isExpanded ? 'border-b border-gray-50' : ''}
                            ${isExpanded ? 'bg-violet-50/30' : 'hover:bg-gray-50/60'}`}
                        >
                          {/* Subject Name */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${attendanceBarColor(e.attendance_percent)}`} />
                              <span className={`font-semibold transition ${isExpanded ? 'text-violet-700' : 'text-gray-800'}`}>
                                {e.subject_name}
                              </span>
                              {isExpanded
                                ? <ChevronUp size={13} className="text-violet-400 ml-1" />
                                : <ChevronDown size={13} className="text-gray-300 ml-1 opacity-0 group-hover:opacity-100 transition" />
                              }
                            </div>
                          </td>

                          {/* Code */}
                          <td className="px-3 py-3.5">
                            <span className="text-xs font-mono text-gray-500">{e.subject_code}</span>
                          </td>

                          {/* Attendance bar */}
                          <td className="px-3 py-3.5">
                            <AttendanceBar value={e.attendance_percent} />
                          </td>

                          {/* Internals */}
                          <td className="px-3 py-3.5 text-center">
                            <span className="font-semibold text-gray-800">{e.internal_marks}</span>
                            <span className="text-gray-400">/{e.max_internal_marks}</span>
                          </td>

                          {/* Assignment */}
                          <td className="px-3 py-3.5 text-center">
                            <span className="font-semibold text-gray-800">{e.assignment_marks}</span>
                            <span className="text-gray-400">/{e.max_assignment_marks}</span>
                          </td>

                          {/* Grade */}
                          <td className="px-3 py-3.5 text-center">
                            <span className={`font-bold text-sm ${gradeColor(e.grade)}`}>{e.grade}</span>
                          </td>

                          {/* Status */}
                          <td className="px-3 py-3.5 text-center">
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap ${sc.cls}`}>
                              {sc.label}
                            </span>
                          </td>
                        </tr>

                        {/* Expandable assessment row */}
                        {isExpanded && (
                          <AssessmentBreakdown key={`bd-${e.id}`} offeringId={e.offering_id} />
                        )}
                      </>
                    );
                  })
              }
            </tbody>
          </table>

          {/* Table Footer */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50/40">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
              Showing {filtered.length} enrolled subjects
              {activeSemLabel ? ` · ${activeSemLabel}` : ''}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                      n === page
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-gray-500 hover:bg-white hover:border hover:border-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 text-gray-400 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
