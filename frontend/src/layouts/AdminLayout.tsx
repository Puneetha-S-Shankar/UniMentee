import WorkspaceShell from './workspace/WorkspaceShell';
import { ADMIN_NAV } from './workspace/navConfig';

export default function AdminLayout() {
  return <WorkspaceShell workspaceTitle="Administration" navItems={ADMIN_NAV} />;
}
