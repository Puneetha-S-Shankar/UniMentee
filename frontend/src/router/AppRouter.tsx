import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from '../features/auth/pages/LoginPage';
import ProtectedRoute from './ProtectedRoute';
import DashboardLayout from '../layouts/DashboardLayout';
import LoadingSpinner from '../components/shared/LoadingSpinner';

// Lazy load all workspace route files
const StudentRoutes = lazy(() => import('./routes/StudentRoutes'));
const MentorRoutes = lazy(() => import('./routes/MentorRoutes'));
const ParentRoutes = lazy(() => import('./routes/ParentRoutes'));
const FacultyRoutes = lazy(() => import('./routes/FacultyRoutes'));
const HODRoutes = lazy(() => import('./routes/HODRoutes'));
const AdminRoutes = lazy(() => import('./routes/AdminRoutes'));

/**
 * AppRouter Component
 * 
 * Main application router using React Router v6
 * 
 * Public routes:
 *   - /login → LoginPage
 * 
 * Protected routes (wrapped in ProtectedRoute + DashboardLayout):
 *   - /student/* → StudentRoutes (lazy)
 *   - /mentor/* → MentorRoutes (lazy)
 *   - /parent/* → ParentRoutes (lazy)
 *   - /faculty/* → FacultyRoutes (lazy)
 *   - /hod/* → HODRoutes (lazy)
 *   - /admin/* → AdminRoutes (lazy)
 * 
 * Fallback routes:
 *   - / → redirect to /login
 *   - * → redirect to /login
 */
export default function AppRouter() {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<LoginPage />} />

      {/* Protected Routes - Wrapped in ProtectedRoute + DashboardLayout */}
      <Route element={<ProtectedRoute />}>
        <Route element={<DashboardLayout />}>
          {/* Student Routes */}
          <Route
            path="/student/*"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <StudentRoutes />
              </Suspense>
            }
          />

          {/* Mentor Routes */}
          <Route
            path="/mentor/*"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <MentorRoutes />
              </Suspense>
            }
          />

          {/* Parent Routes */}
          <Route
            path="/parent/*"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <ParentRoutes />
              </Suspense>
            }
          />

          {/* Faculty Routes */}
          <Route
            path="/faculty/*"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <FacultyRoutes />
              </Suspense>
            }
          />

          {/* HOD Routes */}
          <Route
            path="/hod/*"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <HODRoutes />
              </Suspense>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<LoadingSpinner />}>
                <AdminRoutes />
              </Suspense>
            }
          />
        </Route>
      </Route>

      {/* Fallback Routes */}
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
