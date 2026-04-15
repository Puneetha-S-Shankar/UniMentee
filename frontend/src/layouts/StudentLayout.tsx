import WorkspaceShell from './workspace/WorkspaceShell';
import { STUDENT_NAV } from './workspace/navConfig';

export default function StudentLayout() {
  return <WorkspaceShell workspaceTitle="Student workspace" navItems={STUDENT_NAV} />;
}
