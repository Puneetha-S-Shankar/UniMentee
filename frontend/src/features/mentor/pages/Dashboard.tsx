import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Users, AlertTriangle, Clock, Star, Plus, Megaphone,
  FileBarChart2, MoreVertical, ChevronRight, Search,
  Bell, Settings, LogOut, Calendar
} from 'lucide-react';
import api from '../../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MenteeAssignment {
  id: number;
  student_id: number;
  student_name: string;
  student_photo?: string;
  program: string;
  semester: number;
  attendance_percent: number;
  cgpa: number;
  follow_up_required: boolean;
  last_session_date?: string;
}

interface Session {
  id: number;
  student_id: number;
  student_name: string;
  session_type: string;
  scheduled_at: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getRiskType(m: MenteeAssignment): 'ACADEMIC' | 'ATTENDANCE' | null {
  if (m.cgpa < 6) return 'ACADEMIC';
  if (m.attendance_percent < 75) return 'ATTENDANCE';
  return null;
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

function Avatar({ name, photo, size = 'md' }: { name: string; photo?: string; size?: 'sm' | 'md' }) {
  const dim = size === 'sm' ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm';
  if (photo) return <img src={photo} alt={name} className={`${dim} rounded-full object-cover`} />;
  const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = ['bg-violet-100 text-violet-600', 'bg-blue-100 text-blue-600', 'bg-green-100 text-green-600', 'bg-orange-100 text-orange-600'];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`${dim} ${color} rounded-full flex items-center justify-center font-bold shrink-0`}>
      {initials}
    </div>
  );
}

// ─── KPI Card ────────────────────────────────────────────────────────────────

function KpiCard({
  icon, label, value, delta, deltaPositive, iconBg
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  delta: string;
  deltaPositive: boolean;
  iconBg: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${deltaPositive ? 'text-green-600 bg-green-50' : 'text-red-500 bg-red-50'}`}>
          {delta}
        </span>
      </div>
      <div>
        <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-bold text-gray-900 mt-0.5">{value}</p>
      </div>
    </div>
  );
}

// ─── Session Date Block ───────────────────────────────────────────────────────

function SessionCard({ session }: { session: Session }) {
  const date = new Date(session.scheduled_at);
  const month = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = date.getDate();
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const typeColors: Record<string, string> = {
    'Academic Review': 'bg-violet-100 text-violet-700',
    'Career Guidance': 'bg-blue-100 text-blue-700',
    'Thesis Review': 'bg-green-100 text-green-700',
  };
  const color = typeColors[session.session_type] ?? 'bg-gray-100 text-gray-600';

  return (
    <div className="flex items-center gap-3 py-3 border-b border-gray-50 last:border-0">
      <div className="w-11 text-center shrink-0">
        <div className="bg-violet-600 text-white text-xs font-bold rounded-t-lg py-0.5 leading-tight">{month}</div>
        <div className="bg-violet-50 text-violet-800 text-lg font-bold rounded-b-lg py-0.5 leading-tight">{day}</div>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-800 text-sm truncate">{session.student_name}</p>
        <p className="text-xs text-gray-400 mt-0.5">{time} · {session.session_type}</p>
      </div>
      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 hidden sm:block ${color}`}>
        {session.session_type.split(' ')[0]}
      </span>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function MentorDashboard() {
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const [search, setSearch] = useState('');

  const { data: assignments = [], isLoading } = useQuery<MenteeAssignment[]>({
    queryKey: ['mentor-assignments'],
    queryFn: () => api.get('/mentor/assignments').then(r => r.data),
  });

  const { data: allSessions = [] } = useQuery<Session[]>({
    queryKey: ['mentor-sessions-all'],
    queryFn: async () => {
      const results = await Promise.all(
        assignments.map(a =>
          api.get(`/mentor/assignments/${a.id}/sessions`).then(r => r.data as Session[])
        )
      );
      return results.flat();
    },
    enabled: assignments.length > 0,
  });

  // KPIs
  const totalMentees = assignments.length;
  const atRisk = assignments.filter(m => getRiskType(m) !== null);
  const pendingFollowUps = assignments.filter(m => m.follow_up_required).length;
  const avgCGPA = totalMentees > 0
    ? (assignments.reduce((s, m) => s + m.cgpa, 0) / totalMentees).toFixed(2)
    : '0.00';

  const upcoming = allSessions
    .filter(s => s.status === 'SCHEDULED' && new Date(s.scheduled_at) >= new Date())
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
    .slice(0, 3);

  const filteredAtRisk = atRisk.filter(m =>
    m.student_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-display">

      {/* Top Bar */}
      <div className="bg-white border-b border-gray-100 px-6 h-16 flex items-center gap-4 sticky top-0 z-20">
        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search student by name or ID"
              className="w-full pl-8 pr-4 py-2 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition"
            />
          </div>
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <button className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"><Bell size={18} /></button>
          <button className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"><Settings size={18} /></button>
          <button className="p-2 rounded-xl hover:bg-gray-100 transition text-gray-500"><LogOut size={18} /></button>
        </div>
      </div>

      <div className="p-6 space-y-6 max-w-screen-xl mx-auto">

        {/* Page Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mentor Dashboard</h1>
            <p className="text-sm text-gray-400 mt-0.5">Manage your mentees and track their academic progress.</p>
          </div>
          <button className="flex items-center gap-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl shadow-sm transition">
            <Plus size={16} />
            New Session
          </button>
        </div>

        {/* KPI Row */}
        {isLoading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              icon={<Users size={20} className="text-blue-500" />}
              iconBg="bg-blue-50"
              label="Total Mentees"
              value={totalMentees}
              delta="+2%"
              deltaPositive
            />
            <KpiCard
              icon={<AlertTriangle size={20} className="text-red-500" />}
              iconBg="bg-red-50"
              label="At-Risk Students"
              value={atRisk.length}
              delta="-1%"
              deltaPositive={false}
            />
            <KpiCard
              icon={<Clock size={20} className="text-orange-500" />}
              iconBg="bg-orange-50"
              label="Pending Follow-Ups"
              value={pendingFollowUps}
              delta="-3%"
              deltaPositive={false}
            />
            <KpiCard
              icon={<Star size={20} className="text-violet-500" />}
              iconBg="bg-violet-50"
              label="Average CGPA"
              value={avgCGPA}
              delta="+0.05%"
              deltaPositive
            />
          </div>
        )}

        {/* Main grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* At-Risk Table */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">At-Risk Students Monitoring</h3>
              <button className="text-xs font-bold text-violet-600 hover:text-violet-800 tracking-wider uppercase flex items-center gap-1 transition">
                View All <ChevronRight size={13} />
              </button>
            </div>

            {isLoading ? (
              <div className="p-5 space-y-3">
                {[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filteredAtRisk.length === 0 ? (
              <div className="py-16 text-center">
                <AlertTriangle size={28} className="text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">{search ? 'No matches found.' : 'No at-risk students. 🎉'}</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-wider text-gray-400 bg-gray-50/60">
                    <th className="px-5 py-3 text-left">Student Name</th>
                    <th className="px-3 py-3 text-center">Attendance %</th>
                    <th className="px-3 py-3 text-center">CGPA</th>
                    <th className="px-3 py-3 text-left">Risk Type</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredAtRisk.map(m => {
                    const risk = getRiskType(m);
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/40 transition">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-3">
                            <Avatar name={m.student_name} photo={m.student_photo} />
                            <div>
                              <p className="font-semibold text-gray-800">{m.student_name}</p>
                              <p className="text-xs text-gray-400">{m.program} · Sem {m.semester}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`text-sm font-bold ${m.attendance_percent < 75 ? 'text-red-500' : 'text-gray-700'}`}>
                            {m.attendance_percent}%
                          </span>
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`text-sm font-bold ${m.cgpa < 6 ? 'text-red-500' : 'text-gray-700'}`}>
                            {m.cgpa.toFixed(1)}
                          </span>
                        </td>
                        <td className="px-3 py-3.5">
                          {risk === 'ACADEMIC' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-600 border border-red-200">
                              <AlertTriangle size={10} />
                              ACADEMIC RISK
                            </span>
                          )}
                          {risk === 'ATTENDANCE' && (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-orange-100 text-orange-600 border border-orange-200">
                              <Clock size={10} />
                              ATTENDANCE RISK
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-right">
                          <div className="relative inline-block">
                            <button
                              onClick={() => setMenuOpen(menuOpen === m.id ? null : m.id)}
                              className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-400"
                            >
                              <MoreVertical size={15} />
                            </button>
                            {menuOpen === m.id && (
                              <div className="absolute right-0 top-8 z-30 bg-white border border-gray-100 rounded-xl shadow-lg py-1 w-44 text-sm">
                                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 font-medium transition">View Profile</button>
                                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 font-medium transition">Schedule Session</button>
                                <button className="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-700 font-medium transition">Send Message</button>
                                <button className="w-full text-left px-4 py-2 hover:bg-red-50 text-red-600 font-medium transition">Mark Follow-up</button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-5">

            {/* Upcoming Sessions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar size={15} className="text-violet-500" />
                  <h3 className="font-bold text-gray-900 text-sm">Upcoming Sessions</h3>
                </div>
              </div>

              {upcoming.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-6">No upcoming sessions.</p>
              ) : (
                <div className="divide-y divide-gray-50">
                  {upcoming.map(s => <SessionCard key={s.id} session={s} />)}
                </div>
              )}

              <button className="w-full mt-3 text-center text-xs font-semibold text-violet-600 hover:text-violet-800 py-2 rounded-xl hover:bg-violet-50 transition">
                View Schedule
              </button>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 text-sm mb-3">Quick Actions</h3>
              <div className="space-y-2.5">
                <button className="w-full flex items-center gap-3 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold px-4 py-3 rounded-xl transition shadow-sm">
                  <Plus size={16} />
                  Create New Session
                </button>
                <button className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold px-4 py-3 rounded-xl border border-gray-200 transition">
                  <Megaphone size={16} className="text-gray-500" />
                  Send Announcement
                </button>
                <button className="w-full flex items-center gap-3 bg-gray-50 hover:bg-gray-100 text-gray-700 text-sm font-semibold px-4 py-3 rounded-xl border border-gray-200 transition">
                  <FileBarChart2 size={16} className="text-gray-500" />
                  Generate Report
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* Click-away for dropdown */}
      {menuOpen !== null && (
        <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(null)} />
      )}
    </div>
  );
}
