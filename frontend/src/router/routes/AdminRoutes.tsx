import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, Link } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import ProtectedRoute from '../ProtectedRoute';

const AdminDashboardPage = lazy(() => import('../../features/admin/pages/AdminDashboardPage'));
const UsersPage = lazy(() => import('../../features/admin/pages/UsersPage'));
const StudentsAdminPage = lazy(() => import('../../features/admin/pages/StudentsAdminPage'));
const MentorAssignmentsPage = lazy(() => import('../../features/admin/pages/MentorAssignmentsPage'));
const ProgramsPage = lazy(() => import('../../features/admin/pages/ProgramsPage'));
const BatchesPage = lazy(() => import('../../features/admin/pages/BatchesPage'));
const SubjectsPage = lazy(() => import('../../features/admin/pages/SubjectsPage'));
const SectionsPage = lazy(() => import('../../features/admin/pages/SectionsPage'));
const UniversitySettingsPage = lazy(() => import('../../features/admin/pages/UniversitySettingsPage'));
const OfferingsPage = lazy(() => import('../../features/admin/pages/OfferingsPage'));
const AuditLogPage = lazy(() => import('../../features/admin/pages/AuditLogPage'));

export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route
        path="dashboard"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <AdminDashboardPage />
          </Suspense>
        }
      />
      <Route
        path="users"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <UsersPage />
          </Suspense>
        }
      />
      <Route path="users/new" element={<Navigate to="/admin/users" replace state={{ openCreate: true }} />} />
      <Route
        path="students/new"
        element={<Navigate to="/admin/students" replace state={{ openCreate: true }} />}
      />
      <Route
        path="students/:studentId"
        element={
          <div className="mx-auto max-w-2xl px-4 py-12 text-center text-gray-600 dark:text-gray-400">
            Student profile view will connect to GET /students/:id when available.
            <br />
            <Link to="/admin/students" className="mt-4 inline-block text-primary hover:underline">
              Back to students
            </Link>
          </div>
        }
      />
      <Route
        path="students"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <StudentsAdminPage />
          </Suspense>
        }
      />
      <Route
        path="programs"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <ProgramsPage />
          </Suspense>
        }
      />
      <Route
        path="batches"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <BatchesPage />
          </Suspense>
        }
      />
      <Route
        path="subjects"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <SubjectsPage />
          </Suspense>
        }
      />
      <Route
        path="sections"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <SectionsPage />
          </Suspense>
        }
      />
      <Route path="reports" element={<div>Admin Reports</div>} />
      <Route path="portfolio" element={<div>Portfolio verification</div>} />
      <Route path="analytics" element={<div>Admin analytics</div>} />
      <Route
        path="offerings"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <OfferingsPage />
          </Suspense>
        }
      />
      <Route
        path="mentor-assignments"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <MentorAssignmentsPage />
          </Suspense>
        }
      />
      <Route
        path="audit-log"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <AuditLogPage />
          </Suspense>
        }
      />
      <Route
        path="settings"
        element={
          <ProtectedRoute requiredPermissions={['ORG_MANAGE']}>
            <Suspense fallback={<LoadingSpinner />}>
              <UniversitySettingsPage />
            </Suspense>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
