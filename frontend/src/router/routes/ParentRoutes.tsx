import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const ParentDashboardPage = lazy(() => import('../../features/parent/pages/ParentDashboardPage'));
const ParentChildProgressPage = lazy(() => import('../../features/parent/pages/ParentChildProgressPage'));

export default function ParentRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/parent/dashboard" replace />} />
      <Route
        path="dashboard"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <ParentDashboardPage />
          </Suspense>
        }
      />
      <Route
        path="child-progress"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <ParentChildProgressPage />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/parent/dashboard" replace />} />
    </Routes>
  );
}
