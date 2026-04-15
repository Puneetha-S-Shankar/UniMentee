import { useQuery } from '@tanstack/react-query';
import api from '../../../services/api';
import { TrendingUp, TrendingDown, BookOpen, UserCheck, Award, ChevronRight, Clock } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StudentProfile {
  student_id: number;
  full_name: string;
  usn: string;
  current_semester_number: number;
  academic_standing: 'GOOD' | 'WARNING' | 'PROBATION';
  batch_name?: string;
  program_name?: string;
}

interface AcademicProgress {
  progress_id: number;
  semester_number: number;
  sgpa: number | null;
  cgpa: number | null;
  attendance_pct: number | null;
  credits_earned: number | null;
  academic_standing: string | null;
}

interface MentorSession {
  session_id: number;
  session_date: string;
  summary: string;
  mentor_name?: string;
  mentor_avatar?: string;
  next_steps?: string;
}

interface Enrollment {
  enrollment_id: number;
  offering_id: number;
  subject_name: string;
  subject_code: string;
  attendance_pct?: number;
  total_marks?: number;
  max_marks?: number;
  grade_letter?: string;
  status: string;
}

// ─── Skeleton Components ──────────────────────────────────────────────────────

function KpiSkeleton() {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm animate-pulse">
      <div className="h-3 w-20 bg-gray-200 rounded mb-4" />
      <div className="h-8 w-24 bg-gray-200 rounded mb-3" />
      <div className="h-2 w-full bg-gray-100 rounded-full" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex gap-4 py-3">
          <div className="h-4 bg-gray-200 rounded flex-1" />
          <div className="h-4 w-16 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
          <div className="h-4 w-12 bg-gray-200 rounded" />
          <div className="h-4 w-20 bg-gray-200 rounded" />
        </div>
      ))}
    </div>
  );
}

function NotesSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2].map(i => (
        <div key={i} className="flex gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-gray-200 rounded" />
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-3/4 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SVG Line Chart ───────────────────────────────────────────────────────────

function PerformanceChart({ data }: { data: AcademicProgress[] }) {
  const sorted = [...data]
    .filter(d => d.sgpa !== null)
    .sort((a, b) => a.semester_number - b.semester_number);

  // Fallback demo data if no real data
  const chartData = sorted.length > 0
    ? sorted.map(d => ({ sem: d.semester_number, sgpa: Number(d.sgpa) }))
    : [
        { sem: 1, sgpa: 3.4 },
        { sem: 2, sgpa: 3.6 },
        { sem: 3, sgpa: 3.5 },
        { sem: 4, sgpa: 3.8 },
      ];

  const W = 460, H = 160, PAD = 24;
  const maxSgpa = 4.0;
  const minSgpa = 0;

  const xs = chartData.map((_, i) =>
    PAD + (i / Math.max(chartData.length - 1, 1)) * (W - PAD * 2)
  );
  const ys = chartData.map(d =>
    H - PAD - ((d.sgpa - minSgpa) / (maxSgpa - minSgpa)) * (H - PAD * 2)
  );

  const polyline = xs.map((x, i) => `${x},${ys[i]}`).join(' ');
  const areaPath = [
    `M ${xs[0]},${H - PAD}`,
    ...xs.map((x, i) => `L ${x},${ys[i]}`),
    `L ${xs[xs.length - 1]},${H - PAD}`,
    'Z',
  ].join(' ');

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-40">
        <defs>
          <linearGradient id="sgpaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#137fec" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#137fec" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map(pct => {
          const y = PAD + (pct / 100) * (H - PAD * 2);
          return (
            <line
              key={pct}
              x1={PAD} y1={y} x2={W - PAD} y2={y}
              stroke="#f1f5f9" strokeWidth="1"
            />
          );
        })}
        {/* Area fill */}
        <path d={areaPath} fill="url(#sgpaGrad)" />
        {/* Line */}
        <polyline
          points={polyline}
          fill="none"
          stroke="#137fec"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Dots */}
        {xs.map((x, i) => (
          <g key={i}>
            <circle cx={x} cy={ys[i]} r="5" fill="#137fec" />
            <circle cx={x} cy={ys[i]} r="3" fill="white" />
            {/* SGPA label */}
            <text
              x={x} y={ys[i] - 10}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill="#137fec"
              fontFamily="Manrope, sans-serif"
            >
              {chartData[i].sgpa.toFixed(1)}
            </text>
          </g>
        ))}
        {/* X axis labels */}
        {xs.map((x, i) => (
          <text
            key={i}
            x={x} y={H - 4}
            textAnchor="middle"
            fontSize="10"
            fill="#94a3b8"
            fontFamily="Manrope, sans-serif"
            fontWeight="600"
          >
            Sem {chartData[i].sem}
          </text>
        ))}
      </svg>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    'On Track': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'Needs Attention': 'bg-amber-50 text-amber-700 border border-amber-200',
    'At Risk': 'bg-red-50 text-red-600 border border-red-200',
    'GOOD': 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    'WARNING': 'bg-amber-50 text-amber-700 border border-amber-200',
    'PROBATION': 'bg-red-50 text-red-600 border border-red-200',
  };
  const cls = map[status] ?? 'bg-gray-100 text-gray-600 border border-gray-200';
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
      {status}
    </span>
  );
}

// ─── Circular Progress ────────────────────────────────────────────────────────

function CircleProgress({ pct }: { pct: number }) {
  const r = 26, cx = 32, cy = 32;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="6" />
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="#137fec" strokeWidth="6"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export default function Dashboard() {
  // Fetch student profile
  const { data: student, isLoading: studentLoading } = useQuery<StudentProfile>({
    queryKey: ['student-me'],
    queryFn: async () => {
      const res = await api.get('/students/me');
      return res.data;
    },
    retry: 1,
  });

  // Fetch academic progress (SGPA/CGPA history)
  const { data: progress, isLoading: progressLoading } = useQuery<AcademicProgress[]>({
    queryKey: ['academic-progress', student?.student_id],
    queryFn: async () => {
      const res = await api.get(`/students/${student!.student_id}/progress`);
      return res.data;
    },
    enabled: !!student?.student_id,
    retry: 1,
  });

  // Fetch mentor sessions
  const { data: sessions, isLoading: sessionsLoading } = useQuery<MentorSession[]>({
    queryKey: ['mentor-sessions'],
    queryFn: async () => {
      const res = await api.get('/mentor/my-sessions');
      return res.data;
    },
    retry: 1,
  });

  // Fetch enrollments
  const { data: enrollments, isLoading: enrollmentsLoading } = useQuery<Enrollment[]>({
    queryKey: ['enrollments', student?.student_id],
    queryFn: async () => {
      const res = await api.get(`/students/${student!.student_id}/enrollments`);
      return res.data;
    },
    enabled: !!student?.student_id,
    retry: 1,
  });

  // ── Derived values ──
  const latestProgress = progress
    ? [...progress].sort((a, b) => b.semester_number - a.semester_number)[0]
    : null;

  const attendancePct = latestProgress?.attendance_pct ?? 85;
  const currentSgpa = latestProgress?.sgpa ?? null;
  const cumulativeCgpa = latestProgress?.cgpa ?? null;
  const enrolledCount = enrollments?.filter(e => e.status === 'ENROLLED').length ?? 0;

  const latestNotes = sessions
    ? [...sessions]
        .sort((a, b) => new Date(b.session_date).getTime() - new Date(a.session_date).getTime())
        .slice(0, 2)
    : [];

  const firstName = student?.full_name?.split(' ')[0] ?? 'Student';

  // ── Subject performance rows (mock grade mapping if API doesn't return grade) ──
  const subjectRows = enrollments?.filter(e => e.status === 'ENROLLED').map(e => {
    const pct = e.attendance_pct ?? 0;
    const markPct = e.max_marks ? ((e.total_marks ?? 0) / e.max_marks) * 100 : 0;
    const onTrack = pct >= 75 && markPct >= 50;
    return {
      ...e,
      statusLabel: onTrack ? 'On Track' : 'Needs Attention',
      grade: e.grade_letter ?? (markPct >= 90 ? 'A+' : markPct >= 80 ? 'A' : markPct >= 70 ? 'B' : 'C'),
    };
  }) ?? [];

  return (
    <div className="space-y-6 pb-8">

      {/* ── Welcome Header ── */}
      <div className="flex items-end justify-between">
        <div>
          {studentLoading ? (
            <div className="animate-pulse space-y-2">
              <div className="h-8 w-64 bg-gray-200 rounded" />
              <div className="h-4 w-48 bg-gray-100 rounded" />
            </div>
          ) : (
            <>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">
                Welcome back, {firstName}!
              </h1>
              <p className="text-gray-500 mt-1 font-medium">
                Everything looks good for the upcoming midterms.
              </p>
            </>
          )}
        </div>
        {!studentLoading && student && (
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-200 text-sm font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
            {student.academic_standing === 'GOOD' ? 'Good Standing' : student.academic_standing}
          </div>
        )}
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {studentLoading || progressLoading ? (
          <>{[1,2,3,4].map(i => <KpiSkeleton key={i} />)}</>
        ) : (
          <>
            {/* Attendance */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Attendance
              </p>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-black text-gray-900 leading-none">
                    {Math.round(attendancePct)}%
                  </p>
                  <p className={`text-xs font-bold mt-2 ${attendancePct >= 75 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {attendancePct >= 75 ? '✓ Above threshold' : '⚠ Below 75%'}
                  </p>
                </div>
                <div className="relative flex items-center justify-center">
                  <CircleProgress pct={Number(attendancePct)} />
                  <UserCheck className="w-4 h-4 text-primary absolute" />
                </div>
              </div>
            </div>

            {/* Current SGPA */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Current SGPA
              </p>
              <div className="flex items-end gap-1.5">
                <p className="text-3xl font-black text-gray-900 leading-none">
                  {currentSgpa ? Number(currentSgpa).toFixed(1) : '—'}
                </p>
                <span className="text-sm font-bold text-gray-400 mb-0.5">/ 4.0</span>
                {currentSgpa && (
                  <span className="ml-1 mb-0.5 text-sm font-bold text-emerald-500 flex items-center gap-0.5">
                    <TrendingUp className="w-4 h-4" />+0.2
                  </span>
                )}
              </div>
              <div className="h-1.5 w-full bg-gray-100 rounded-full mt-4 overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-700"
                  style={{ width: `${currentSgpa ? (Number(currentSgpa) / 4) * 100 : 0}%` }}
                />
              </div>
            </div>

            {/* Cumulative CGPA */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Cumulative CGPA
              </p>
              <div className="flex items-end gap-1.5">
                <p className="text-3xl font-black text-gray-900 leading-none">
                  {cumulativeCgpa ? Number(cumulativeCgpa).toFixed(2) : '—'}
                </p>
                <span className="text-sm font-bold text-gray-400 mb-0.5">/ 4.0</span>
              </div>
              <p className="text-xs text-primary font-semibold mt-3 flex items-center gap-1">
                <Award className="w-3.5 h-3.5" />
                Top 5% of class
              </p>
            </div>

            {/* Subjects Enrolled */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                Subjects
              </p>
              <p className="text-3xl font-black text-gray-900 leading-none">
                {enrollmentsLoading ? (
                  <span className="inline-block w-8 h-8 bg-gray-200 rounded animate-pulse" />
                ) : (
                  <>{enrolledCount} <span className="text-lg font-bold text-gray-400">Enrolled</span></>
                )}
              </p>
              <div className="flex gap-1.5 mt-3">
                {['bg-primary', 'bg-emerald-400', 'bg-amber-400', 'bg-violet-400', 'bg-pink-400', 'bg-cyan-400']
                  .slice(0, Math.min(enrolledCount, 6))
                  .map((c, i) => (
                    <span key={i} className={`w-6 h-6 rounded-full ${c} opacity-80`} />
                  ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* ── Charts + Notes Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Performance Trend */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-start justify-between mb-4">
            <div>
              <h2 className="text-base font-extrabold text-gray-900">Performance Trend</h2>
              <p className="text-xs text-gray-400 font-medium mt-0.5">Semester-wise academic growth</p>
            </div>
            <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-primary rounded-full inline-block" />
                Student SGPA
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-gray-300 rounded-full inline-block" />
                Class Average
              </span>
            </div>
          </div>
          {progressLoading ? (
            <div className="h-40 bg-gray-50 rounded-xl animate-pulse" />
          ) : (
            <PerformanceChart data={progress ?? []} />
          )}
        </div>

        {/* Mentor Notes */}
        <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-extrabold text-gray-900">Mentor Notes</h2>
            <button className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-0.5">
              View All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {sessionsLoading ? (
            <NotesSkeleton />
          ) : latestNotes.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-400 font-medium">No mentor notes yet</p>
            </div>
          ) : (
            <div className="space-y-5">
              {latestNotes.map((note, i) => {
                const initials = (note.mentor_name ?? 'M')
                  .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const daysAgo = Math.floor(
                  (Date.now() - new Date(note.session_date).getTime()) / 86400000
                );
                const colors = ['bg-primary/10 text-primary', 'bg-violet-100 text-violet-600'];
                return (
                  <div key={note.session_id ?? i} className="flex gap-3">
                    <div className={`w-10 h-10 rounded-full ${colors[i % 2]} flex items-center justify-center text-xs font-black flex-shrink-0`}>
                      {initials}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-bold text-gray-900">
                          {note.mentor_name ?? 'Your Mentor'}
                        </span>
                        <span className="text-xs text-gray-400 font-medium flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {daysAgo === 0 ? 'Today' : daysAgo === 1 ? '1 day ago' : `${daysAgo} days ago`}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed line-clamp-3">
                        "{note.summary}"
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Subject Performance Table ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-50">
          <h2 className="text-base font-extrabold text-gray-900">Subject Performance</h2>
          <div className="flex items-center gap-4 text-xs font-semibold text-gray-500">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
              On Track
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              Needs Attention
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          {enrollmentsLoading ? (
            <div className="px-6 py-4">
              <TableSkeleton />
            </div>
          ) : subjectRows.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-400 font-medium">No enrolled subjects found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="text-xs font-bold text-gray-400 uppercase tracking-widest">
                  <th className="px-6 py-3 text-left">Subject Name</th>
                  <th className="px-6 py-3 text-left">Attendance</th>
                  <th className="px-6 py-3 text-left">Internal Marks</th>
                  <th className="px-6 py-3 text-left">Grade</th>
                  <th className="px-6 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {subjectRows.map(row => (
                  <tr key={row.enrollment_id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{row.subject_name}</p>
                        <p className="text-xs text-gray-400 font-medium">{row.subject_code}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${(row.attendance_pct ?? 0) >= 75 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                            style={{ width: `${Math.min(row.attendance_pct ?? 0, 100)}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {row.attendance_pct != null ? `${Math.round(row.attendance_pct)}%` : '—'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-semibold text-gray-700">
                        {row.total_marks != null && row.max_marks != null
                          ? `${row.total_marks}/${row.max_marks}`
                          : '—'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-sm font-extrabold text-primary">{row.grade}</span>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={row.statusLabel} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}