import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

// Lazy load all student page components
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Attendance = lazy(() => import('./pages/Attendance'));
const Subjects = lazy(() => import('./pages/Subjects'));
const MentorNotes = lazy(() => import('./pages/MentorNotes'));
const Profile = lazy(() => import('./pages/Profile'));

/**
 * StudentRoutes Component
 * 
 * Defines all routes accessible to students.
 * All routes are nested under DashboardLayout (configured in AppRouter).
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
            <Attendance />
          </Suspense>
        }
      />

      {/* Student Subjects */}
      <Route
        path="subjects"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <Subjects />
          </Suspense>
        }
      />

      {/* Student Mentor Notes */}
      <Route
        path="mentor-notes"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <MentorNotes />
          </Suspense>
        }
      />

      {/* Student Profile */}
      <Route
        path="profile"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <Profile />
          </Suspense>
        }
      />

      {/* Fallback for unknown routes */}
      <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
    </Routes>
  );
}
