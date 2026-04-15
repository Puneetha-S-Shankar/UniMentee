import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

// Lazy load all student page components
const Dashboard = lazy(() => import('./pages/StudentDashboardPage'));
const StudentAttendancePage = lazy(() => import('./pages/StudentAttendancePage'));
const StudentSubjectsPage = lazy(() => import('./pages/StudentSubjectsPage'));
const StudentMentorNotesPage = lazy(() => import('./pages/StudentMentorNotesPage'));
const StudentProfilePage = lazy(() => import('./pages/StudentProfilePage'));
const StudentPerformancePage = lazy(() => import('./pages/StudentPerformancePage'));
const StudentPortfolioPage = lazy(() => import('./pages/StudentPortfolioPage'));
const AnnouncementsPage = lazy(() => import('./pages/AnnouncementsPage'));

/**
 * StudentRoutes Component
 * 
 * Defines all routes accessible to students.
 * Nested under StudentLayout (see `src/router/index.tsx`).
 * 
 * Routes:
 *   /student/dashboard → Dashboard
 *   /student/attendance → Attendance
 *   /student/subjects → Subjects
 *   /student/mentor-notes → MentorNotes
 *   /student/profile → Profile
 */
export default function StudentRoutes() {
  return (
    <Routes>
      {/* Default redirect to dashboard */}
      <Route index element={<Navigate to="/student/dashboard" replace />} />

      {/* Student Dashboard */}
      <Route
        path="dashboard"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <Dashboard />
          </Suspense>
        }
      />

      {/* Student Attendance */}
      <Route
        path="attendance"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <StudentAttendancePage />
          </Suspense>
        }
      />

      {/* Student Subjects */}
      <Route
        path="subjects"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <StudentSubjectsPage />
          </Suspense>
        }
      />

      {/* Student Mentor Notes */}
      <Route
        path="mentor-notes"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <StudentMentorNotesPage />
          </Suspense>
        }
      />

      {/* Student Profile */}
      <Route
        path="profile"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <StudentProfilePage />
          </Suspense>
        }
      />

      {/* Academic performance (marks, SGPA/CGPA) */}
      <Route
        path="performance"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <StudentPerformancePage />
          </Suspense>
        }
      />

      {/* Portfolio */}
      <Route
        path="portfolio"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <StudentPortfolioPage />
          </Suspense>
        }
      />

      {/* Announcements */}
      <Route
        path="announcements"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <AnnouncementsPage />
          </Suspense>
        }
      />

      {/* Fallback for unknown routes */}
      <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
    </Routes>
  );
}
