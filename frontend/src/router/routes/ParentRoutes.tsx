import { Routes, Route, Navigate } from 'react-router-dom';

/**
 * ParentRoutes Component
 * 
 * Defines all routes accessible to parents
 */
export default function ParentRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="/parent/dashboard" replace />} />
      <Route path="dashboard" element={<div>Parent Dashboard</div>} />
      <Route path="child-progress" element={<div>Child Progress</div>} />
      <Route path="*" element={<Navigate to="/parent/dashboard" replace />} />
    </Routes>
  );
}
