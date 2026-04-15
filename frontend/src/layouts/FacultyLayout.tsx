import WorkspaceShell from './workspace/WorkspaceShell';
import { FACULTY_NAV } from './workspace/navConfig';

export default function FacultyLayout() {
  return <WorkspaceShell workspaceTitle="Faculty workspace" navItems={FACULTY_NAV} />;
}
