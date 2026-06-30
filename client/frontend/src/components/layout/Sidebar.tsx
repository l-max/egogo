import { useState } from 'react';
import { SidebarPanels } from '../sidebar/SidebarPanels';
import { ProfileBar } from './ProfileBar';

export function Sidebar() {
  const [projectsExpanded, setProjectsExpanded] = useState(true);
  const [environmentsExpanded, setEnvironmentsExpanded] = useState(true);

  return (
    <aside className="sidebar">
      <SidebarPanels
        projectsExpanded={projectsExpanded}
        environmentsExpanded={environmentsExpanded}
        onToggleProjects={() => setProjectsExpanded((v) => !v)}
        onToggleEnvironments={() => setEnvironmentsExpanded((v) => !v)}
      />
      <ProfileBar />
    </aside>
  );
}
