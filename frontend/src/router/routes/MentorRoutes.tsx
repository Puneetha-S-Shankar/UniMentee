import { Routes, Route, Navigate } from 'react-router-dom';
import MentorDashboard from '../../features/mentor/pages/Dashboard';
import MenteeList from '../../features/mentor/pages/MenteeList';
import MenteeDetail from '../../features/mentor/pages/MenteeDetail';
import SessionNote from '../../features/mentor/pages/SessionNote';

/**
 * MentorRoutes Component
 *
 * Defines all routes accessible to mentors
 */
export default function MentorRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/mentor/dashboard" replace />} />
      <Route path="dashboard" element={<MentorDashboard />} />
      <Route path="mentees" element={<MenteeList />} />
      <Route path="students/:studentId" element={<MenteeDetail />} />
      <Route path="students/:studentId/session/new" element={<SessionNote />} />
      <Route path="sessions/new" element={<SessionNote />} />
      <Route path="*" element={<Navigate to="/mentor/dashboard" replace />} />
    </Routes>
  );
}
