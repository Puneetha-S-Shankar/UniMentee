import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const MentorDashboardPage = lazy(() => import('../../features/mentor/pages/MentorDashboardPage'));
const SessionsPage = lazy(() => import('../../features/mentor/pages/SessionsPage'));
const NewSessionPage = lazy(() => import('../../features/mentor/pages/NewSessionPage'));
const MenteesListPage = lazy(() => import('../../features/mentor/pages/MenteesListPage'));
const MenteeDetailPage = lazy(() => import('../../features/mentor/pages/MenteeDetailPage'));

export default function MentorRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/mentor/dashboard" replace />} />
      <Route
        path="dashboard"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <MentorDashboardPage />
          </Suspense>
        }
      />
      <Route
        path="sessions"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <SessionsPage />
          </Suspense>
        }
      />
      <Route
        path="mentees"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <MenteesListPage />
          </Suspense>
        }
      />
      <Route
        path="mentees/:studentId"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <MenteeDetailPage />
          </Suspense>
        }
      />
      <Route
        path="students/:studentId"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <MenteeDetailPage />
          </Suspense>
        }
      />
      <Route
        path="students/:studentId/session/new"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <NewSessionPage />
          </Suspense>
        }
      />
      <Route
        path="sessions/new"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <NewSessionPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/mentor/dashboard" replace />} />
    </Routes>
  );
}
