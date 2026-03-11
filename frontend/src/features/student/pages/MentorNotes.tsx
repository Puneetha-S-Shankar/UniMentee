import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar, BookOpen, Briefcase, AlertTriangle,
  MessageCircle, Search, ChevronDown, Clock,
  ArrowRight, RefreshCw, Zap, CheckSquare
} from 'lucide-react';
import api from '../../../services/api';

// ─── Types ───────────────────────────────────────────────────────────────────

interface MentorSession {
  id: number;
  mentor_name: string;
  mentor_photo?: string;
  session_type: 'Academic Review' | 'Career Mentoring' | 'Probation Review' | 'General Check-in';
  subject?: string;
  date: string;
  topics_discussed?: string;
  action_items?: string[];
  risk_category: 'NO_RISK' | 'ATTENDANCE_RISK' | 'ACADEMIC_RISK';
  follow_up_required: boolean;
  follow_up_date?: string;
  notes?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function priorityFromRisk(risk: MentorSession['risk_category']): 'HIGH' | 'NORMAL' | 'LOW' {
  if (risk === 'ACADEMIC_RISK') return 'HIGH';
  if (risk === 'ATTENDANCE_RISK') return 'NORMAL';
  return 'LOW';
}

function priorityStyle(p: 'HIGH' | 'NORMAL' | 'LOW') {
  const map = {
    HIGH: { cls: 'bg-orange-50 text-orange-600 border border-orange-200', dot: 'bg-orange-500', label: '⚡ HIGH PRIORITY' },
    NORMAL: { cls: 'bg-blue-50 text-blue-600 border border-blue-200', dot: 'bg-blue-400', label: '● NORMAL PRIORITY' },
    LOW: { cls: 'bg-green-50 text-green-700 border border-green-200', dot: 'bg-green-400', label: '✓ LOW PRIORITY' },
  };
  return map[p];
}

function sessionTypeStyle(type: MentorSession['session_type']) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode; dotColor: string }> = {
    'Academic Review': {
      bg: 'bg-violet-50', text: 'text-violet-600',
      icon: <BookOpen size={11} />, dotColor: 'bg-violet-500'
    },
    'Career Mentoring': {
      bg: 'bg-blue-50', text: 'text-blue-600',
      icon: <Briefcase size={11} />, dotColor: 'bg-blue-500'
    },
    'Probation Review': {
      bg: 'bg-red-50', text: 'text-red-600',
      icon: <AlertTriangle size={11} />, dotColor: 'bg-red-500'
    },
    'General Check-in': {
      bg: 'bg-gray-50', text: 'text-gray-600',
      icon: <MessageCircle size={11} />, dotColor: 'bg-gray-400'
    },
  };
  return map[type] ?? map['General Check-in'];
}

function timelineLineDot(type: MentorSession['session_type']) {
  const map: Record<string, string> = {
    'Academic Review': 'border-violet-400 bg-violet-50',
    'Career Mentoring': 'border-blue-400 bg-blue-50',
    'Probation Review': 'border-red-400 bg-red-50',
    'General Check-in': 'border-gray-300 bg-gray-50',
  };
  return map[type] ?? 'border-gray-300 bg-gray-50';
}

function actionItemIcon(item: string) {
  const lower = item.toLowerCase();
  if (lower.includes('attend')) return <TrendingUpIcon />;
  if (lower.includes('schedule') || lower.includes('follow')) return <Calendar size={11} />;
  if (lower.includes('prepare') || lower.includes('assessment')) return <CheckSquare size={11} />;
  return <ArrowRight size={11} />;
}

function TrendingUpIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
      <polyline points="16 7 22 7 22 13" />
    </svg>
  );
}

function Avatar({ name, photo }: { name: string; photo?: string }) {
  if (photo) return <img src={photo} alt={name} className="w-11 h-11 rounded-full object-cover shrink-0" />;
  const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const colors = [
    'bg-violet-200 text-violet-700',
    'bg-blue-200 text-blue-700',
    'bg-green-200 text-green-700',
    'bg-orange-200 text-orange-700',
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div className={`w-11 h-11 rounded-full ${color} flex items-center justify-center text-sm font-bold shrink-0`}>
      {initials}
    </div>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-100 rounded ${className}`} />;
}

// ─── Session Card ─────────────────────────────────────────────────────────────

function SessionCard({ session, isLast }: { session: MentorSession; isLast: boolean }) {
  const priority = priorityFromRisk(session.risk_category);
  const ps = priorityStyle(priority);
  const ts = sessionTypeStyle(session.session_type);
  const dotStyle = timelineLineDot(session.session_type);

  const actionItems = session.action_items ?? (session.notes ? [] : []);
  const displayNotes = session.topics_discussed ?? session.notes ?? '';

  return (
    <div className="relative flex gap-5">
      {/* Timeline spine */}
      <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
        <div className={`w-5 h-5 rounded-full border-2 z-10 flex items-center justify-center mt-5 ${dotStyle}`}>
          <div className={`w-2 h-2 rounded-full ${ts.dotColor}`} />
        </div>
        {!isLast && <div className="w-0.5 flex-1 bg-gray-200 mt-1" />}
      </div>

      {/* Card */}
      <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm mb-5 overflow-hidden">
        {/* Card Header */}
        <div className="flex items-start justify-between gap-4 px-5 pt-4 pb-3">
          <div className="flex items-center gap-3">
            <Avatar name={session.mentor_name} photo={session.mentor_photo} />
            <div>
              <p className="font-bold text-gray-900 text-sm">{session.mentor_name}</p>
              <div className="flex items-center flex-wrap gap-1.5 mt-0.5">
                {session.subject && (
                  <span className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
                    {ts.icon}
                    {session.subject}
                  </span>
                )}
                {!session.subject && (
                  <span className={`flex items-center gap-1 text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${ts.bg} ${ts.text}`}>
                    {ts.icon}
                    {session.session_type}
                  </span>
                )}
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-400">
                  {new Date(session.date).toLocaleDateString('en-US', {
                    month: 'short', day: 'numeric', year: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Priority Badge */}
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${ps.cls}`}>
            {ps.label}
          </span>
        </div>

        {/* Notes / Topics */}
        {displayNotes && (
          <div className="px-5 pb-3">
            <p className="text-sm text-gray-600 italic leading-relaxed">
              "{displayNotes}"
            </p>
          </div>
        )}

        {/* Action Items */}
        {actionItems.length > 0 && (
          <div className="px-5 pb-4 border-t border-gray-50 pt-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2">
              Recommended Actions
            </p>
            <div className="flex flex-wrap gap-2">
              {actionItems.map((item, idx) => {
                const isSchedule = item.toLowerCase().includes('schedule');
                return (
                  <button
                    key={idx}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition border
                      ${isSchedule
                        ? 'bg-violet-600 text-white border-violet-600 hover:bg-violet-700'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-violet-300 hover:text-violet-600'
                      }`}
                  >
                    <span className={isSchedule ? 'text-white' : 'text-violet-500'}>
                      {actionItemIcon(item)}
                    </span>
                    {item}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Follow-up strip */}
        {session.follow_up_required && session.follow_up_date && (
          <div className="px-5 py-2.5 bg-orange-50 border-t border-orange-100 flex items-center gap-2">
            <Clock size={12} className="text-orange-500 shrink-0" />
            <span className="text-xs text-orange-700 font-medium">
              Follow-up scheduled:{' '}
              <span className="font-bold">
                {new Date(session.follow_up_date).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric', year: 'numeric'
                })}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ filtered }: { filtered: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-16 h-16 rounded-full bg-violet-50 flex items-center justify-center mb-4">
        <MessageCircle size={24} className="text-violet-300" />
      </div>
      <h3 className="font-bold text-gray-700 text-base">
        {filtered ? 'No matching notes' : 'No mentor feedback yet'}
      </h3>
      <p className="text-sm text-gray-400 mt-1 max-w-xs">
        {filtered
          ? 'Try adjusting your filters to find what you\'re looking for.'
          : 'Your mentor hasn\'t shared any session notes with you yet. Check back after your next meeting.'}
      </p>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

const SESSION_TYPES = [
  'All',
  'Academic Review',
  'Career Mentoring',
  'Probation Review',
  'General Check-in',
] as const;

const PRIORITY_OPTIONS = ['All', 'High', 'Normal', 'Low'] as const;

const PAGE_SIZE = 5;

export default function MentorNotes() {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const { data: sessions = [], isLoading } = useQuery<MentorSession[]>({
    queryKey: ['student-mentor-sessions'],
    queryFn: () => api.get('/mentor/my-sessions').then(r => r.data),
  });

  const filtered = useMemo(() => {
    return sessions
      .filter(s => {
        const matchType = typeFilter === 'All' || s.session_type === typeFilter;
        const priority = priorityFromRisk(s.risk_category);
        const matchPriority =
          priorityFilter === 'All' ||
          (priorityFilter === 'High' && priority === 'HIGH') ||
          (priorityFilter === 'Normal' && priority === 'NORMAL') ||
          (priorityFilter === 'Low' && priority === 'LOW');
        const matchSearch =
          s.mentor_name.toLowerCase().includes(search.toLowerCase()) ||
          (s.topics_discussed ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (s.notes ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (s.subject ?? '').toLowerCase().includes(search.toLowerCase());
        return matchType && matchPriority && matchSearch;
      })
      .sort((a, b) => {
        const da = new Date(a.date).getTime();
        const db = new Date(b.date).getTime();
        return sortOrder === 'newest' ? db - da : da - db;
      });
  }, [sessions, typeFilter, priorityFilter, search, sortOrder]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  return (
    <div className="min-h-screen bg-[#f7f8fa] font-display p-6 space-y-5 max-w-3xl">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Mentor Feedback</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Review guidance and academic recommendations from your mentor.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Date / Sort */}
        <div className="relative">
          <button
            onClick={() => setSortOrder(o => o === 'newest' ? 'oldest' : 'newest')}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:border-gray-300 shadow-sm transition"
          >
            <Calendar size={13} className="text-gray-400" />
            Date
            <ChevronDown size={12} className="text-gray-400" />
          </button>
        </div>

        {/* Subject / Type */}
        <div className="relative">
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="appearance-none pl-8 pr-7 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer"
          >
            {SESSION_TYPES.map(t => (
              <option key={t} value={t}>{t === 'All' ? 'Subject' : t}</option>
            ))}
          </select>
          <BookOpen size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Priority */}
        <div className="relative">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value)}
            className="appearance-none pl-8 pr-7 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/20 shadow-sm cursor-pointer"
          >
            {PRIORITY_OPTIONS.map(p => (
              <option key={p} value={p}>{p === 'All' ? 'Priority' : `${p} Priority`}</option>
            ))}
          </select>
          <Zap size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notes..."
            className="w-full pl-8 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition"
          />
        </div>
      </div>

      {/* Sort indicator */}
      {sortOrder === 'oldest' && (
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Clock size={11} /> Showing oldest first
        </p>
      )}

      {/* Timeline */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex gap-5">
              <div className="flex flex-col items-center shrink-0" style={{ width: 20 }}>
                <Skeleton className="w-5 h-5 rounded-full mt-5" />
                <div className="w-0.5 flex-1 bg-gray-100 mt-1" />
              </div>
              <Skeleton className="flex-1 h-36 rounded-2xl mb-5" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filtered={typeFilter !== 'All' || priorityFilter !== 'All' || search !== ''} />
      ) : (
        <>
          <div>
            {visible.map((session, idx) => (
              <SessionCard
                key={session.id}
                session={session}
                isLast={idx === visible.length - 1 && !hasMore}
              />
            ))}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="flex justify-center pt-2">
              <button
                onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
                className="flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-full text-sm font-semibold text-gray-600 hover:border-violet-300 hover:text-violet-600 shadow-sm transition"
              >
                <RefreshCw size={14} />
                View Older Feedback
              </button>
            </div>
          )}

          {/* Summary */}
          {!hasMore && filtered.length > 0 && (
            <p className="text-center text-xs text-gray-400 pt-2">
              All {filtered.length} note{filtered.length !== 1 ? 's' : ''} shown
            </p>
          )}
        </>
      )}
    </div>
  );
}
