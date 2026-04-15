import WorkspaceShell from './workspace/WorkspaceShell';
import { PARENT_NAV } from './workspace/navConfig';

export default function ParentLayout() {
  return <WorkspaceShell workspaceTitle="Parent portal" navItems={PARENT_NAV} />;
}
