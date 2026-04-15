import WorkspaceShell from './workspace/WorkspaceShell';
import { MENTOR_NAV } from './workspace/navConfig';

export default function MentorLayout() {
  return <WorkspaceShell workspaceTitle="Mentor workspace" navItems={MENTOR_NAV} />;
}
