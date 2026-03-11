import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * HODRoutes Component
 * 
 * Defines all routes accessible to Head of Department
 */
export default function HODRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/hod/dashboard" replace />} />
      <Route path="dashboard" element={<div>HOD Dashboard</div>} />
      <Route path="reports" element={<div>HOD Reports</div>} />
      <Route path="programs" element={<div>HOD Programs</div>} />
      <Route path="faculty" element={<div>HOD Faculty Management</div>} />
      <Route path="*" element={<Navigate to="/hod/dashboard" replace />} />
    </Routes>
  );
}
