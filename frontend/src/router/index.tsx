import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RootRedirect from './RootRedirect';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const LoginPage = lazy(() => import('../features/auth/pages/LoginPage'));

const StudentLayout = lazy(() => import('../layouts/StudentLayout'));
const MentorLayout = lazy(() => import('../layouts/MentorLayout'));
const FacultyLayout = lazy(() => import('../layouts/FacultyLayout'));
const AdminLayout = lazy(() => import('../layouts/AdminLayout'));
const HODLayout = lazy(() => import('../layouts/HODLayout'));
const ParentLayout = lazy(() => import('../layouts/ParentLayout'));
const CourseLeadLayout = lazy(() => import('../layouts/CourseLeadLayout'));

const StudentRoutes = lazy(() => import('../features/student/StudentRoutes'));
const MentorRoutes = lazy(() => import('./routes/MentorRoutes'));
const FacultyRoutes = lazy(() => import('./routes/FacultyRoutes'));
const AdminRoutes = lazy(() => import('./routes/AdminRoutes'));
const HODRoutes = lazy(() => import('./routes/HODRoutes'));
const ParentRoutes = lazy(() => import('./routes/ParentRoutes'));
const CourseLeadRoutes = lazy(() => import('./routes/CourseLeadRoutes'));

function PageSuspense({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingSpinner />}>{children}</Suspense>;
}

/**
 * UniMentee ERP — `createBrowserRouter` tree.
 * Authenticated area uses {@link ProtectedRoute} (token + `/auth/me` hydration) and per-role workspace layouts.
 */
export const appRouter = createBrowserRouter([
  {
    path: '/login',
    element: (
      <PageSuspense>
        <LoginPage />
      </PageSuspense>
    ),
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <RootRedirect /> },
      {
        path: 'student',
        element: (
          <PageSuspense>
            <StudentLayout />
          </PageSuspense>
        ),
        children: [
          {
            path: '*',
            element: (
              <PageSuspense>
                <StudentRoutes />
              </PageSuspense>
            ),
          },
        ],
      },
      {
        path: 'mentor',
        element: (
          <PageSuspense>
            <MentorLayout />
          </PageSuspense>
        ),
        children: [
          {
            path: '*',
            element: (
              <PageSuspense>
                <MentorRoutes />
              </PageSuspense>
            ),
          },
        ],
      },
      {
        path: 'faculty',
        element: (
          <PageSuspense>
            <FacultyLayout />
          </PageSuspense>
        ),
        children: [
          {
            path: '*',
            element: (
              <PageSuspense>
                <FacultyRoutes />
              </PageSuspense>
            ),
          },
        ],
      },
      {
        path: 'admin',
        element: (
          <PageSuspense>
            <AdminLayout />
          </PageSuspense>
        ),
        children: [
          {
            path: '*',
            element: (
              <PageSuspense>
                <AdminRoutes />
              </PageSuspense>
            ),
          },
        ],
      },
      {
        path: 'hod',
        element: (
          <PageSuspense>
            <HODLayout />
          </PageSuspense>
        ),
        children: [
          {
            path: '*',
            element: (
              <PageSuspense>
                <HODRoutes />
              </PageSuspense>
            ),
          },
        ],
      },
      {
        path: 'parent',
        element: (
          <PageSuspense>
            <ParentLayout />
          </PageSuspense>
        ),
        children: [
          {
            path: '*',
            element: (
              <PageSuspense>
                <ParentRoutes />
              </PageSuspense>
            ),
          },
        ],
      },
      {
        path: 'course-lead',
        element: (
          <PageSuspense>
            <CourseLeadLayout />
          </PageSuspense>
        ),
        children: [
          {
            path: '*',
            element: (
              <PageSuspense>
                <CourseLeadRoutes />
              </PageSuspense>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/login" replace /> },
]);
