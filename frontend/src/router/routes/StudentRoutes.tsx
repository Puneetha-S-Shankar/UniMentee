import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * StudentRoutes Component
 * 
 * Defines all routes accessible to students
 */
export default function StudentRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/student/dashboard" replace />} />
      <Route path="dashboard" element={<div>Student Dashboard</div>} />
      <Route path="attendance" element={<div>Student Attendance</div>} />
      <Route path="marks" element={<div>Student Marks</div>} />
      <Route path="subjects" element={<div>Student Subjects</div>} />
      <Route path="mentor-notes" element={<div>Student Mentor Notes</div>} />
      <Route path="*" element={<Navigate to="/student/dashboard" replace />} />
    </Routes>
  );
}
