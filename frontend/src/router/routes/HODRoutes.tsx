import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const HODDashboard = lazy(() => import('../../features/hod/pages/HODDashboardPage'));

export default function HODRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/hod/dashboard" replace />} />
      <Route
        path="dashboard"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <HODDashboard />
          </Suspense>
        }
      />
      <Route path="reports" element={<div>HOD Reports</div>} />
      <Route path="programs" element={<div>HOD Programs</div>} />
      <Route path="faculty" element={<div>HOD Faculty Management</div>} />
      <Route path="*" element={<Navigate to="/hod/dashboard" replace />} />
    </Routes>
  );
}
