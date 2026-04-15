import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

const CourseLeadDashboard = lazy(() => import('../../features/courseLead/pages/CourseLeadDashboardPage'));
const CourseLeadOfferings = lazy(() => import('../../features/courseLead/pages/CourseLeadOfferingsPage'));
const CourseLeadAnalytics = lazy(() => import('../../features/courseLead/pages/CourseLeadAnalyticsPage'));
const MarksVerification = lazy(() => import('../../features/courseLead/pages/MarksVerificationPage'));

export default function CourseLeadRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/course-lead/dashboard" replace />} />
      <Route
        path="dashboard"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <CourseLeadDashboard />
          </Suspense>
        }
      />
      <Route
        path="offerings"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <CourseLeadOfferings />
          </Suspense>
        }
      />
      <Route
        path="analytics"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <CourseLeadAnalytics />
          </Suspense>
        }
      />
      <Route
        path="marks-verification"
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <MarksVerification />
          </Suspense>
        }
      />
      <Route path="*" element={<Navigate to="/course-lead/dashboard" replace />} />
    </Routes>
  );
}
