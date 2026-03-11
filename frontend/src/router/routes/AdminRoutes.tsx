import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * AdminRoutes Component
 * 
 * Defines all routes accessible to administrators
 */
export default function AdminRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="dashboard" element={<div>Admin Dashboard</div>} />
      <Route path="users" element={<div>Admin User Management</div>} />
      <Route path="programs" element={<div>Admin Programs</div>} />
      <Route path="reports" element={<div>Admin Reports</div>} />
      <Route path="settings" element={<div>Admin Settings</div>} />
      <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
    </Routes>
  );
}
