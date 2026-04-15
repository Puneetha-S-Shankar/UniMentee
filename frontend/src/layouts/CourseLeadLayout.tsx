import WorkspaceShell from './workspace/WorkspaceShell';
import { COURSE_LEAD_NAV } from './workspace/navConfig';

export default function CourseLeadLayout() {
  return <WorkspaceShell workspaceTitle="Course lead" navItems={COURSE_LEAD_NAV} />;
}
