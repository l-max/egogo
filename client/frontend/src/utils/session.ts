import type { ProfileSession, RequestTab, Project, Environment } from '../types';
import { findRequest } from './tree';

export function createEmptyRequestTab(name: string): RequestTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    method: 'GET',
    url: '',
    body: '',
    kind: 'request',
  };
}

export function reconcileSession(
  session: ProfileSession,
  projects: Project[],
  environments: Environment[]
): ProfileSession {
  const envIds = new Set(environments.map((e) => e.id));

  const tabs = session.tabs.filter((tab) => {
    if (tab.kind === 'settings') return true;
    if (tab.kind === 'environment') {
      return Boolean(tab.environmentId && envIds.has(tab.environmentId));
    }
    if (tab.kind === 'request') {
      if (!tab.requestId) return true;
      return findRequest(projects, tab.requestId) !== null;
    }
    return false;
  });

  let activeTabId = session.activeTabId;
  if (tabs.length === 0) {
    activeTabId = '';
  } else if (!tabs.some((tab) => tab.id === activeTabId)) {
    activeTabId = tabs[tabs.length - 1].id;
  }

  let activeEnvironmentId = session.activeEnvironmentId;
  if (activeEnvironmentId && !envIds.has(activeEnvironmentId)) {
    activeEnvironmentId = environments[0]?.id ?? null;
  }

  return { tabs, activeTabId, activeEnvironmentId };
}
