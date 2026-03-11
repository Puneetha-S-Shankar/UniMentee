import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * MentorRoutes Component
 * 
 * Defines all routes accessible to mentors
 */
export default function MentorRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/mentor/dashboard" replace />} />
      <Route path="dashboard" element={<div>Mentor Dashboard</div>} />
      <Route path="mentees" element={<div>Mentor Mentees</div>} />
      <Route path="sessions" element={<div>Mentor Sessions</div>} />
      <Route path="*" element={<Navigate to="/mentor/dashboard" replace />} />
    </Routes>
  );
}
