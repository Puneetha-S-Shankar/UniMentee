import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * FacultyRoutes Component
 * 
 * Defines all routes accessible to faculty members
 */
export default function FacultyRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/faculty/dashboard" replace />} />
      <Route path="dashboard" element={<div>Faculty Dashboard</div>} />
      <Route path="attendance" element={<div>Faculty Attendance</div>} />
      <Route path="marks" element={<div>Faculty Marks</div>} />
      <Route path="sessions" element={<div>Faculty Sessions</div>} />
      <Route path="*" element={<Navigate to="/faculty/dashboard" replace />} />
    </Routes>
  );
}
