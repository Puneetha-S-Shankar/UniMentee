import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import ProtectedRoute from '../ProtectedRoute';

const FacultyDashboardPage = lazy(() => import('../../features/faculty/pages/FacultyDashboardPage'));
const FacultySessionsPage = lazy(() => import('../../features/faculty/pages/FacultySessionsPage'));
const AttendanceMarkPage = lazy(() => import('../../features/faculty/pages/AttendanceMarkPage'));
const MarksEntryPage = lazy(() => import('../../features/faculty/pages/MarksEntryPage'));
const SubjectAnalyticsPage = lazy(() => import('../../features/faculty/pages/SubjectAnalyticsPage'));

/**
 * Faculty routes — permission-gated pages use {@link ProtectedRoute}.
 */
export default function FacultyRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/faculty/dashboard" replace />} />
      <Route
        path="dashboard"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <FacultyDashboardPage />
          </Suspense>
        }
      />
      <Route
        path="subjects/:offeringId/attendance"
        element={
          <ProtectedRoute requiredPermissions={['ATTENDANCE_MARK']}>
            <Suspense fallback={<LoadingSpinner />}>
              <AttendanceMarkPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="subjects/:offeringId/marks"
        element={
          <ProtectedRoute requiredPermissions={['MARKS_ENTER']}>
            <Suspense fallback={<LoadingSpinner />}>
              <MarksEntryPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route
        path="subjects/:offeringId/analytics"
        element={
          <ProtectedRoute requiredPermissions={['MARKS_VIEW_ALL', 'ATTENDANCE_VIEW_ALL']}>
            <Suspense fallback={<LoadingSpinner />}>
              <SubjectAnalyticsPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="attendance" element={<Navigate to="/faculty/dashboard" replace />} />
      <Route path="marks" element={<Navigate to="/faculty/dashboard" replace />} />
      <Route
        path="sessions"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <FacultySessionsPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/faculty/dashboard" replace />} />
    </Routes>
  );
}
