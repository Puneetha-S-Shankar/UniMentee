/** Shared types for mentor mentee detail tabs */

export interface StudentDetail {
  student_id: number;
  usn: string;
  program_id: number;
  batch_id: number;
  section_id: number | null;
  admission_date?: string | null;
  current_semester_number: number | null;
  cgpa: number | null;
  status: string;
  user: { full_name: string; email: string };
}

export interface MenteeListRow {
  assignment_id: number;
  student: {
    student_id: number;
    usn: string;
    full_name: string;
    email: string;
    cgpa: number | null;
    batch_id: number;
    section_id: number | null;
    status?: string;
  };
  at_risk: { attendance: boolean; academic: boolean };
}

export interface AttendanceSessionRow {
  session_id: number;
  session_date: string;
  session_type: string;
  status: string;
  remark: string | null;
}

export interface AttendanceSummary {
  offering_id: number;
  subject_code: string;
  subject_name: string;
  total_sessions: number;
  present: number;
  absent: number;
  late: number;
  percentage: number;
  sessions: AttendanceSessionRow[];
}

export interface AssessmentMarkDetail {
  assessment_id: number;
  title: string;
  max_marks: number;
  marks_obtained: number | null;
  is_absent: boolean;
  status: string;
  percentage: number | null;
}

export interface OfferingMarks {
  offering_id: number;
  subject_name?: string | null;
  assessments: AssessmentMarkDetail[];
}

export interface AcademicTerm {
  term_id: number;
  name: string;
  academic_year_id: number;
  is_current: boolean;
}

export interface ProgressRow {
  term_id: number;
  semester_number: number;
  sgpa: number | null;
  cgpa: number | null;
  sgpa_status: string;
}

/** GET /students/:id/academic-summary */
export interface AcademicSummary {
  latest_sgpa: number | null;
  cgpa: number | null;
  trend: { term_id: number; term: string; sgpa: number }[];
}

export interface MentorSessionRow {
  session_id: number;
  assignment_id: number;
  session_date: string;
  session_time?: string | null;
  duration_minutes?: number | null;
  session_type: string;
  topics_discussed?: string | null;
  action_items?: string | null;
  follow_up_required: boolean;
  follow_up_date?: string | null;
  career_notes?: string | null;
  created_by: number;
}

export interface AssignmentRow {
  assignment_id: number;
  student_id: number;
  mentor_user_id: number;
  status: string;
}

export interface SubjectOut {
  subject_id: number;
  subject_code: string;
  subject_name: string;
}

export interface OfferingOut {
  offering_id: number;
  curriculum_id: number;
  batch_id: number;
  term_id: number;
}
