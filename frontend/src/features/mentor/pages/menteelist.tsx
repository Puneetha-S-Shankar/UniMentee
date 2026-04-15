import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search, Download, Users, AlertTriangle, TrendingUp,
  ChevronLeft, ChevronRight, SlidersHorizontal, Plus,
  Bell, Settings, ChevronDown
} from 'lucide-react';
import api from '../../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Assignment {
  id: number;
  student_id: number;
  batch_id: number;
}

interface Student {
  id: number;
  name: string;
  usn: string;
  photo_url?: string;
  program: string;
  batch: string;
  semester: number;
  attendance_percent: number;
  cgpa: number;
  academic_status: 'GOOD_STANDING' | 'PROBATION' | 'WARNING';
}

type RiskLevel = 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW';
type RiskIndicator = 'HIGH' | 'MEDIUM' | 'LOW';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRisk(s: Student): RiskIndicator {
  if (s.cgpa < 5 || s.attendance_percent < 65) return 'HIGH';
  if (s.cgpa < 6.5 || s.attendance_percent < 75) return 'MEDIUM';
  return 'LOW';
}

function riskStyle(r: RiskIndicator) {
  if (r === 'HIGH') return { dot: 'bg-red-500', text: 'text-red-600', bg: 'bg-red-50 border-red-200' };
  if (r === 'MEDIUM') return { dot: 'bg-orange-400', text: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' };
  return { dot: 'bg-green-400', text: 'text-green-600', bg: 'bg-green-50 border-green-200' };
}

function statusStyle(s: Student['academic_status']) {
  if (s === 'PROBATION') return 'bg-orange-500 text-white';
  if (s === 'WARNING') return 'bg-red-500 text-white';
  return 'bg-emerald-500 text-white';
}

function statusLabel(s: Student['academic_status']) {
  if (s === 'GOOD_STANDING') return 'GOOD STANDING';
  return s;
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  if (photo) return <img src={photo} alt={name} className="w-9 h-9 rounded-full object-cover shrink-0" />;
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = [
    'bg-violet-100 text-violet-600', 'bg-blue-100 text-blue-600',
    'bg-green-100 text-green-600', 'bg-orange-100 text-orange-600',
    'bg-pink-100 text-pink-600'
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-9 h-9 ${color} rounded-full flex items-center justify-center text-xs font-bold shrink-0`}>
      {initials}
    </div>
  );
}

function AttendanceBar({ value }: { value: number }) {
  const color = value >= 85 ? 'bg-green-500' : value >= 75 ? 'bg-yellow-400' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
        <div className={`h-1.5 rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-bold w-8 text-right ${value < 75 ? 'text-red-500' : 'text-gray-700'}`}>
        {value}%
      </span>
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

const PAGE_SIZE = 10;

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MenteeList() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskLevel>('ALL');
  const [programFilter, setProgramFilter] = useState('');
  const [page, setPage] = useState(1);
  const [semester] = useState('Fall 2024');

  // Fetch assignments first
  const { data: assignments = [], isLoading: aLoading } = useQuery<Assignment[]>({
    queryKey: ['mentor-assignments-list'],
    queryFn: () => api.get('/mentor/assignments').then(r => r.data),
  });

  // Fetch student details
  const batchIds = [...new Set(assignments.map(a => a.batch_id))];
  const { data: students = [], isLoading: sLoading } = useQuery<Student[]>({
    queryKey: ['mentor-students', batchIds],
    queryFn: async () => {
      const results = await Promise.all(
        batchIds.map(bid => api.get(`/students?batch_id=${bid}`).then(r => r.data as Student[]))
      );
      const assignedIds = new Set(assignments.map(a => a.student_id));
      return results.flat().filter(s => assignedIds.has(s.id));
    },
    enabled: assignments.length > 0,
  });

  const isLoading = aLoading || sLoading;

  // Derived stats
  const atRiskCount = students.filter(s => getRisk(s) !== 'LOW').length;
  const avgAttendance = students.length
    ? Math.round(students.reduce((s, m) => s + m.attendance_percent, 0) / students.length)
    : 0;

  // Filters + search
  const filtered = useMemo(() => {
    return students.filter(s => {
      const risk = getRisk(s);
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.usn.toLowerCase().includes(search.toLowerCase());
      const matchRisk =
        riskFilter === 'ALL' ? true :
        riskFilter === 'HIGH' ? risk === 'HIGH' :
        riskFilter === 'MEDIUM' ? risk === 'MEDIUM' :
        risk === 'LOW';
      const matchProgram = programFilter ? s.program === programFilter : true;
      return matchSearch && matchRisk && matchProgram;
    });
  }, [students, search, riskFilter, programFilter]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const programs = [...new Set(students.map(s => s.program))];

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p);
  };

  const pageNums = () => {
    const pages = [];
    for (let i = 1; i <= Math.min(totalPages, 9); i++) pages.push(i);
    return pages;
  };

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-display">

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 px-6 h-14 flex items-center gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex-1">
          <div className="relative max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              placeholder="Search subjects..."
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1 text-sm font-semibold text-gray-600 px-3 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition">
            {semester}
            <ChevronDown size={13} className="text-gray-400" />
          </button>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><Bell size={16} /></button>
          <button className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500"><Settings size={16} /></button>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-screen-xl mx-auto">

        {/* Page Header */}
        <div>
          <h1 className="text-xl font-bold text-gray-900">Mentee List</h1>
          <p className="text-xs text-gray-400 mt-0.5">View and manage all students assigned to you.</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            {
              icon: <Users size={18} className="text-blue-500" />,
              iconBg: 'bg-blue-50',
              label: 'Total Students Assigned',
              value: students.length,
              loading: isLoading,
            },
            {
              icon: <AlertTriangle size={18} className="text-red-500" />,
              iconBg: 'bg-red-50',
              label: 'Students At Risk',
              value: String(atRiskCount).padStart(2, '0'),
              loading: isLoading,
            },
            {
              icon: <TrendingUp size={18} className="text-green-500" />,
              iconBg: 'bg-green-50',
              label: 'Average Attendance',
              value: `${avgAttendance}%`,
              loading: isLoading,
            },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${stat.iconBg} shrink-0`}>
                {stat.icon}
              </div>
              <div>
                <p className="text-xs text-gray-400 font-medium">{stat.label}</p>
                {stat.loading
                  ? <Skeleton className="h-7 w-12 mt-1" />
                  : <p className="text-2xl font-bold text-gray-900 leading-tight">{stat.value}</p>
                }
              </div>
            </div>
          ))}
        </div>

        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name or ID"
              className="w-full pl-8 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition shadow-sm"
            />
          </div>

          {/* Risk Level filter */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl shadow-sm px-3 py-1.5">
            <SlidersHorizontal size={13} className="text-gray-400 mr-1" />
            <span className="text-xs text-gray-400 font-medium mr-2">Risk Level:</span>
            {(['ALL', 'HIGH', 'MEDIUM', 'LOW'] as RiskLevel[]).map(r => (
              <button
                key={r}
                onClick={() => { setRiskFilter(r); setPage(1); }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition ${
                  riskFilter === r ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                {r}
              </button>
            ))}
          </div>

          {/* Academic Program filter */}
          <div className="relative">
            <select
              value={programFilter}
              onChange={e => { setProgramFilter(e.target.value); setPage(1); }}
              className="appearance-none bg-white border border-gray-200 rounded-xl shadow-sm text-sm font-medium text-gray-600 px-3 py-2 pr-7 focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="">Academic Program</option>
              {programs.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          <button className="flex items-center gap-2 bg-primary hover:bg-blue-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow-sm transition ml-auto">
            <Download size={14} />
            Download Report
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-gray-400 border-b border-gray-100">
                <th className="px-5 py-3.5 text-left">Student Name</th>
                <th className="px-3 py-3.5 text-left">Student ID</th>
                <th className="px-3 py-3.5 text-center">Attendance %</th>
                <th className="px-3 py-3.5 text-center">CGPA</th>
                <th className="px-3 py-3.5 text-center">Academic Status</th>
                <th className="px-3 py-3.5 text-center">Risk Indicator</th>
                <th className="px-3 py-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading
                ? Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-4">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      ))}
                    </tr>
                  ))
                : paginated.length === 0
                ? (
                  <tr>
                    <td colSpan={7} className="py-16 text-center">
                      <Users size={28} className="text-gray-200 mx-auto mb-2" />
                      <p className="text-sm text-gray-400">No students match your filters.</p>
                    </td>
                  </tr>
                )
                : paginated.map(s => {
                    const risk = getRisk(s);
                    const rs = riskStyle(risk);
                    return (
                      <tr
                        key={s.id}
                        className="hover:bg-gray-50/60 transition cursor-pointer group"
                        onClick={() => navigate(`/mentor/students/${s.id}`)}
                      >
                        {/* Name */}
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={s.name} photo={s.photo_url} />
                            <div>
                              <p className="font-semibold text-gray-800 group-hover:text-primary transition">{s.name}</p>
                              <p className="text-xs text-gray-400">{s.program}</p>
                            </div>
                          </div>
                        </td>

                        {/* USN */}
                        <td className="px-3 py-3.5">
                          <span className="text-xs font-mono text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                            {s.usn}
                          </span>
                        </td>

                        {/* Attendance */}
                        <td className="px-3 py-3.5">
                          <AttendanceBar value={s.attendance_percent} />
                        </td>

                        {/* CGPA */}
                        <td className="px-3 py-3.5 text-center">
                          <span className={`text-sm font-bold ${s.cgpa < 6 ? 'text-red-500' : 'text-gray-800'}`}>
                            {s.cgpa.toFixed(2)}
                          </span>
                        </td>

                        {/* Academic Status */}
                        <td className="px-3 py-3.5 text-center">
                          <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide ${statusStyle(s.academic_status)}`}>
                            {statusLabel(s.academic_status)}
                          </span>
                        </td>

                        {/* Risk Indicator */}
                        <td className="px-3 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${rs.bg} ${rs.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${rs.dot}`} />
                            {risk}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-3.5 text-center" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => navigate(`/mentor/students/${s.id}`)}
                              className="text-xs font-semibold text-primary hover:text-blue-700 hover:underline transition"
                            >
                              View Profile
                            </button>
                            <span className="text-gray-200">|</span>
                            <button
                              onClick={() => navigate(`/mentor/sessions/new?studentId=${s.id}`)}
                              className="p-1 rounded-lg hover:bg-primary/10 text-primary transition"
                              title="Add Session"
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
            </tbody>
          </table>

          {/* Pagination */}
          {!isLoading && filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/40">
              <p className="text-xs text-gray-400">
                Showing {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)} to{' '}
                {Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length} students
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft size={14} />
                </button>
                {pageNums().map(n => (
                  <button
                    key={n}
                    onClick={() => handlePageChange(n)}
                    className={`w-7 h-7 rounded-lg text-xs font-semibold transition ${
                      n === page
                        ? 'bg-primary text-white shadow-sm'
                        : 'text-gray-500 hover:bg-white hover:border hover:border-gray-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
                {totalPages > 9 && <span className="text-gray-400 text-xs px-1">…</span>}
                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg hover:bg-white border border-transparent hover:border-gray-200 text-gray-400 hover:text-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
