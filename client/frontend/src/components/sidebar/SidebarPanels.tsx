import { ChevronRight, ChevronDown, Globe, Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { ProjectTree } from './ProjectTree';
import './SidebarPanels.css';

const INDENT = 16;

interface SidebarPanelsProps {
  projectsExpanded: boolean;
  environmentsExpanded: boolean;
  onToggleProjects: () => void;
  onToggleEnvironments: () => void;
}

export function SidebarPanels({
  projectsExpanded,
  environmentsExpanded,
  onToggleProjects,
  onToggleEnvironments,
}: SidebarPanelsProps) {
  const { environments, openEnvironmentEditor, createProject, t } = useApp();

  return (
    <div className="sidebar-panels">
      <div className={`sidebar-section sidebar-section-top ${projectsExpanded ? 'sidebar-section-grow' : ''}`}>
        <div className="sidebar-section-header-row">
          <button className="sidebar-section-header" onClick={onToggleProjects}>
            <span className="sidebar-section-chevron">
              {projectsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </span>
            <span className="sidebar-section-title-text">{t.sidebar.projects}</span>
          </button>
          <button
            className="sidebar-section-add-btn"
            title={t.sidebar.newProject}
            aria-label={t.sidebar.newProject}
            onClick={() => void createProject()}
          >
            <Plus size={14} />
          </button>
        </div>
        {projectsExpanded && (
          <div className="sidebar-section-body sidebar-section-scroll">
            <ProjectTree />
          </div>
        )}
      </div>

      <div className="sidebar-panels-spacer" />

      <div className="sidebar-section sidebar-section-bottom">
        <button className="sidebar-section-header" onClick={onToggleEnvironments}>
          <span className="sidebar-section-chevron">
            {environmentsExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </span>
          <span className="sidebar-section-title-text">{t.sidebar.environments}</span>
        </button>
        {environmentsExpanded && (
          <div className="sidebar-section-body">
            {environments.map((env) => (
              <div
                key={env.id}
                className="env-item"
                style={{ paddingLeft: `${8 + INDENT}px` }}
                onClick={() => openEnvironmentEditor(env.id)}
              >
                <span className="tree-chevron">
                  <span className="tree-chevron-spacer" />
                </span>
                <span className="tree-icon-wrap">
                  <Globe size={14} className="tree-icon" />
                </span>
                <span className="tree-item-name">{env.name}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
