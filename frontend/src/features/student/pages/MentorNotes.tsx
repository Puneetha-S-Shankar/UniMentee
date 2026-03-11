import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronUp, BookOpen, Award, TrendingUp, Search, Filter } from 'lucide-react';
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
  faculty_name: string;
  attendance_percent: number;
  internal_marks: number;
  max_internal_marks: number;
  assignment_marks: number;
  max_assignment_marks: number;
  grade: string;
  grade_points: number;
  status: 'ON_TRACK' | 'AT_RISK' | 'CRITICAL' | 'COMPLETED';
}

interface Assessment {
  id: number;
  name: string;
  assessment_type: 'INTERNAL' | 'EXTERNAL' | 'ASSIGNMENT' | 'QUIZ' | 'LAB';
  max_marks: number;
  marks_obtained: number;
  date: string;
  weightage?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function gradeColor(grade: string) {
  if (['A+', 'A'].includes(grade)) return 'text-green-600';
  if (['A-', 'B+'].includes(grade)) return 'text-blue-600';
  if (['B', 'B-'].includes(grade)) return 'text-purple-600';
  if (['C+', 'C'].includes(grade)) return 'text-orange-500';
  return 'text-red-500';
}

function statusStyle(s: Enrollment['status']) {
  const map = {
    ON_TRACK: 'bg-emerald-100 text-emerald-700',
    AT_RISK: 'bg-orange-100 text-orange-700',
    CRITICAL: 'bg-red-100 text-red-600',
    COMPLETED: 'bg-gray-100 text-gray-500',
  };
  const label = {
    ON_TRACK: 'ON TRACK',
    AT_RISK: 'AT RISK',
    CRITICAL: 'CRITICAL',
    COMPLETED: 'COMPLETED',
  };
  return { cls: map[s], label: label[s] };
}

function assessmentTypeStyle(t: Assessment['assessment_type']) {
  const map: Record<string, string> = {
    INTERNAL: 'bg-blue-100 text-blue-700',
    EXTERNAL: 'bg-purple-100 text-purple-700',
    ASSIGNMENT: 'bg-green-100 text-green-700',
    QUIZ: 'bg-orange-100 text-orange-700',
    LAB: 'bg-teal-100 text-teal-700',
  };
  return map[t] ?? 'bg-gray-100 text-gray-600';
}

function AttendanceBar({ value }: { value: number }) {
  const color = value >= 85 ? 'bg-green-500' : value >= 75 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold ${value < 75 ? 'text-red-500' : 'text-gray-700'}`}>{value}%</span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

// ─── Assessment Breakdown Row ─────────────────────────────────────────────────

function AssessmentBreakdown({ offeringId }: { offeringId: number }) {
  const { data: assessments = [], isLoading } = useQuery<Assessment[]>({
    queryKey: ['student-assessments', offeringId],
    queryFn: () => api.get(`/marks/offerings/${offeringId}/assessments`).then(r => r.data),
  });

  const totalObtained = assessments.reduce((s, a) => s + (a.marks_obtained ?? 0), 0);
  const totalMax = assessments.reduce((s, a) => s + a.max_marks, 0);
  const overallPct = totalMax > 0 ? Math.round((totalObtained / totalMax) * 100) : 0;

  return (
    <div className="bg-gray-50/80 border-t border-gray-100 px-5 pb-5 pt-4">
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">Assessment Breakdown</h4>
          {!isLoading && assessments.length > 0 && (
            <span className="text-xs font-semibold text-gray-500">
              Overall: <span className="text-gray-800 font-bold">{totalObtained}/{totalMax}</span>
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${overallPct >= 80 ? 'bg-green-100 text-green-700' : overallPct >= 60 ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                {overallPct}%
              </span>
            </span>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : assessments.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No assessments recorded yet.</p>
        ) : (
          <div className="grid gap-2">
            {assessments.map(a => {
              const pct = a.max_marks > 0 ? Math.round((a.marks_obtained / a.max_marks) * 100) : 0;
              const barColor = pct >= 80 ? 'bg-green-500' : pct >= 60 ? 'bg-blue-500' : 'bg-orange-400';
              return (
                <div key={a.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-4">
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${assessmentTypeStyle(a.assessment_type)}`}>
                    {a.assessment_type}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">{a.name}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {a.weightage ? ` · ${a.weightage}% weightage` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="w-24 bg-gray-100 rounded-full h-1.5 overflow-hidden hidden sm:block">
                      <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-sm font-bold text-gray-800 w-16 text-right">
                      {a.marks_obtained ?? '—'}<span className="text-gray-400 font-normal">/{a.max_marks}</span>
                    </span>
                    <span className={`text-xs font-bold w-10 text-right ${pct >= 80 ? 'text-green-600' : pct >= 60 ? 'text-blue-600' : 'text-orange-500'}`}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Subject Row ─────────────────────────────────────────────────────────────

function SubjectRow({ enrollment }: { enrollment: Enrollment }) {
  const [expanded, setExpanded] = useState(false);
  const ss = statusStyle(enrollment.status);

  return (
    <>
      <tr
        className={`hover:bg-gray-50/60 transition cursor-pointer group ${expanded ? 'bg-violet-50/30' : ''}`}
        onClick={() => setExpanded(e => !e)}
      >
        {/* Subject */}
        <td className="px-5 py-4">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${expanded ? 'bg-violet-100' : 'bg-gray-100 group-hover:bg-violet-50'} transition`}>
              <BookOpen size={14} className={expanded ? 'text-violet-600' : 'text-gray-400 group-hover:text-violet-500'} />
            </div>
            <div>
              <p className={`font-semibold text-sm ${expanded ? 'text-violet-700' : 'text-gray-800'} transition`}>{enrollment.subject_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{enrollment.faculty_name}</p>
            </div>
          </div>
        </td>

        {/* Code */}
        <td className="px-3 py-4">
          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">{enrollment.subject_code}</span>
        </td>

        {/* Credits */}
        <td className="px-3 py-4 text-center">
          <span className="text-sm font-bold text-gray-700">{enrollment.credits}</span>
        </td>

        {/* Attendance */}
        <td className="px-3 py-4">
          <AttendanceBar value={enrollment.attendance_percent} />
        </td>

        {/* Internal Marks */}
        <td className="px-3 py-4 text-center">
          <span className="text-sm font-semibold text-gray-800">{enrollment.internal_marks}</span>
          <span className="text-xs text-gray-400">/{enrollment.max_internal_marks}</span>
        </td>

        {/* Assignment */}
        <td className="px-3 py-4 text-center">
          <span className="text-sm font-semibold text-gray-800">{enrollment.assignment_marks}</span>
          <span className="text-xs text-gray-400">/{enrollment.max_assignment_marks}</span>
        </td>

        {/* Grade */}
        <td className="px-3 py-4 text-center">
          <span className={`text-base font-bold ${gradeColor(enrollment.grade)}`}>{enrollment.grade}</span>
        </td>

        {/* Status */}
        <td className="px-3 py-4 text-center">
          <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${ss.cls}`}>{ss.label}</span>
        </td>

        {/* Expand */}
        <td className="px-3 py-4 text-center text-gray-400">
          {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={9} className="p-0">
            <AssessmentBreakdown offeringId={enrollment.offering_id} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function Subjects() {
  const userId = useAuthStore(s => s.userId);
  const [search, setSearch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState<number | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: enrollments = [], isLoading } = useQuery<Enrollment[]>({
    queryKey: ['student-enrollments', userId],
    queryFn: () => api.get(`/students/${userId}/enrollments`).then(r => r.data),
    enabled: !!userId,
  });

  // Derive semester list
  const semesters = [...new Set(enrollments.map(e => e.semester))].sort((a, b) => a - b);

  // Auto-select latest semester on first load
  const activeSemester = selectedSemester === 'all' ? 'all' : selectedSemester;

  const filtered = useMemo(() => {
    return enrollments.filter(e => {
      const matchSem = activeSemester === 'all' || e.semester === activeSemester;
      const matchSearch =
        e.subject_name.toLowerCase().includes(search.toLowerCase()) ||
        e.subject_code.toLowerCase().includes(search.toLowerCase()) ||
        e.faculty_name.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || e.status === statusFilter;
      return matchSem && matchSearch && matchStatus;
    });
  }, [enrollments, activeSemester, search, statusFilter]);

  // Summary stats for active view
  const avgAttendance = filtered.length
    ? Math.round(filtered.reduce((s, e) => s + e.attendance_percent, 0) / filtered.length)
    : 0;
  const avgGradePoints = filtered.length
    ? (filtered.reduce((s, e) => s + e.grade_points, 0) / filtered.length).toFixed(2)
    : '0.00';
  const atRiskCount = filtered.filter(e => e.status === 'AT_RISK' || e.status === 'CRITICAL').length;

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-display p-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Subjects</h1>
          <p className="text-sm text-gray-400 mt-0.5">All enrolled subjects with marks and assessment details.</p>
        </div>
      </div>

      {/* Stats Row */}
      {!isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Enrolled Subjects', value: filtered.length, icon: <BookOpen size={16} className="text-violet-500" />, bg: 'bg-violet-50' },
            { label: 'Avg Attendance', value: `${avgAttendance}%`, icon: <TrendingUp size={16} className="text-blue-500" />, bg: 'bg-blue-50' },
            { label: 'Avg Grade Points', value: avgGradePoints, icon: <Award size={16} className="text-green-500" />, bg: 'bg-green-50' },
            { label: 'At-Risk Subjects', value: atRiskCount, icon: <Filter size={16} className="text-orange-500" />, bg: 'bg-orange-50' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.bg} shrink-0`}>{stat.icon}</div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search subject, code or faculty..."
            className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm"
          />
        </div>

        {/* Semester selector */}
        <div className="relative">
          <select
            value={activeSemester}
            onChange={e => setSelectedSemester(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="appearance-none bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-700 px-3 py-2 pr-8 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="all">All Semesters</option>
            {semesters.map(s => (
              <option key={s} value={s}>Semester {s}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm px-2 py-1.5">
          {[
            { value: 'all', label: 'All' },
            { value: 'ON_TRACK', label: 'On Track' },
            { value: 'AT_RISK', label: 'At Risk' },
            { value: 'CRITICAL', label: 'Critical' },
          ].map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${statusFilter === f.value ? 'bg-violet-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100 bg-gray-50/60">
              <th className="px-5 py-3.5 text-left">Subject</th>
              <th className="px-3 py-3.5 text-left">Code</th>
              <th className="px-3 py-3.5 text-center">Credits</th>
              <th className="px-3 py-3.5 text-left">Attendance</th>
              <th className="px-3 py-3.5 text-center">Internal</th>
              <th className="px-3 py-3.5 text-center">Assignment</th>
              <th className="px-3 py-3.5 text-center">Grade</th>
              <th className="px-3 py-3.5 text-center">Status</th>
              <th className="px-3 py-3.5 text-center w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 9 }).map((_, j) => (
                      <td key={j} className="px-5 py-4">
                        <Skeleton className="h-5 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : filtered.length === 0
              ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center">
                    <BookOpen size={28} className="text-gray-200 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No subjects match your filters.</p>
                  </td>
                </tr>
              )
              : filtered.map(e => <SubjectRow key={e.id} enrollment={e} />)
            }
          </tbody>
        </table>

        {/* Footer count */}
        {!isLoading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-400">
              Showing <span className="font-semibold text-gray-600">{filtered.length}</span> subject{filtered.length !== 1 ? 's' : ''}
              {activeSemester !== 'all' ? ` · Semester ${activeSemester}` : ' · All semesters'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
