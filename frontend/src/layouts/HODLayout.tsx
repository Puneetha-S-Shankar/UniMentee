import WorkspaceShell from './workspace/WorkspaceShell';
import { HOD_NAV } from './workspace/navConfig';

export default function HODLayout() {
  return <WorkspaceShell workspaceTitle="Head of department" navItems={HOD_NAV} />;
}
