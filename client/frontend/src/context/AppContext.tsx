import { createContext, useContext, useCallback, useState, useEffect, useRef, ReactNode } from 'react';
import { t as translate } from '../i18n';
import type {
  AppState,
  AppSettings,
  Profile,
  Project,
  Environment,
  RequestTab,
  HttpMethod,
  ProfileSession,
  CookieStore,
  StoredCookie,
} from '../types';
import type { ResponseCookie } from '../types/request';
import type { NodeRef } from '../utils/tree';
import {
  addFolderTo,
  addRequestTo,
  createDefaultFolder,
  createDefaultRequest,
  deleteNodeFromTree,
  duplicateNodeInTree,
  findRequest,
  getDefaultSaveParent,
  getNodeForCopy,
  newId,
  renameNodeInTree,
  updateRequestInTree,
  moveNodeInTree,
} from '../utils/tree';
import { applyUrlEdit } from '../utils/http';
import { createEmptyRequestTab, reconcileSession } from '../utils/session';
import { emptyCookieStore } from '../types/cookies';
import {
  addDomainToStore,
  clearCookieStore,
  deleteCookieFromStore,
  mergeResponseCookies,
  removeDomainFromStore,
  upsertCookieInStore,
} from '../utils/cookies';

interface AppContextValue extends AppState {
  t: import('../i18n').Translations;
  activeProfile: Profile;
  setLanguage: (lang: 'ru' | 'en') => void;
  setMyProfileName: (name: string) => void;
  switchProfile: (id: string) => void;
  openSettings: () => void;
  openEnvironmentEditor: (environmentId: string) => void;
  saveEnvironment: (environmentId: string, variables: Record<string, string>) => Promise<void>;
  openTab: (tab: Omit<RequestTab, 'id'> & { id?: string }) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  toggleProject: (id: string) => void;
  createProject: () => Promise<void>;
  updateActiveTab: (patch: Partial<RequestTab>) => void;
  saveActiveTab: () => Promise<boolean>;
  treeAction: (ref: NodeRef, action: import('../types').ContextMenuAction) => void;
  renameNode: (ref: NodeRef, name: string) => void;
  moveTreeNode: (source: NodeRef, targetParent: NodeRef) => void;
  addCookieDomain: (domain: string) => void;
  removeCookieDomain: (domain: string) => void;
  upsertCookie: (cookie: StoredCookie) => void;
  deleteCookie: (cookieId: string) => void;
  clearAllCookies: () => void;
  updateCookieAllowlist: (allowlist: string[]) => void;
  applyResponseCookies: (cookies: ResponseCookie[], requestUrl: string) => void;
  signIn: (serverUrl: string, email: string, password: string) => Promise<void>;
  redeemInvite: (inviteUrl: string, password: string) => Promise<void>;
  signOut: (profileId: string) => Promise<void>;
  checkPendingInvite: () => Promise<{ serverUrl: string; email: string; inviteUrl: string } | null>;
}

const defaultProfile: Profile = {
  id: 'my',
  name: 'My',
  type: 'local',
  avatarLetter: 'M',
  avatarColor: '#ff6c37',
  isLoggedIn: true,
};

const defaultProjects: Project[] = [
  {
    id: 'demo',
    name: 'Demo API',
    expanded: true,
    children: [
      {
        type: 'folder',
        data: {
          id: 'users',
          name: 'Users',
          children: [
            {
              type: 'request',
              data: {
                id: 'get-users',
                name: 'Get users',
                method: 'GET',
                url: '{{baseUrl}}/users',
                body: '',
              },
            },
            {
              type: 'request',
              data: {
                id: 'create-user',
                name: 'Create user',
                method: 'POST',
                url: '{{baseUrl}}/users',
                body: '{}',
              },
            },
          ],
        },
      },
      {
        type: 'request',
        data: {
          id: 'health',
          name: 'Health check',
          method: 'GET',
          url: '{{baseUrl}}/health',
          body: '',
        },
      },
    ],
  },
];

const defaultEnvironments: Environment[] = [
  { id: 'dev', name: 'Development', variables: { baseUrl: 'http://localhost:8080' } },
  { id: 'prod', name: 'Production', variables: { baseUrl: 'https://api.example.com' } },
];

async function loadRemoteProjects(profileId: string): Promise<Project[]> {
  try {
    const { SyncRemoteProjects } = await import('../../wailsjs/go/main/App');
    const raw = await SyncRemoteProjects(profileId);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Project[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function loadRemoteProfiles(): Promise<Profile[]> {
  try {
    const { ListRemoteProfiles } = await import('../../wailsjs/go/main/App');
    const raw = await ListRemoteProfiles();
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Profile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function profileFromAuthResult(result: {
  profileId: string;
  serverUrl: string;
  serverName: string;
  displayName: string;
}): Profile {
  return {
    id: result.profileId,
    name: result.displayName,
    serverUrl: result.serverUrl,
    serverName: result.serverName,
    type: 'remote',
    avatarLetter: result.displayName[0]?.toUpperCase() || 'R',
    avatarColor: '#3b82f6',
    isLoggedIn: true,
  };
}

async function activateProfile(
  profileId: string,
  profile: Profile | undefined,
  language: 'ru' | 'en'
): Promise<Partial<AppState>> {
  const emptyTabName = translate(language).tabs.newRequest;
  let projects: Project[];
  let environments: Environment[];
  let isNew = false;

  if (profile?.type === 'remote') {
    projects = await loadRemoteProjects(profileId);
    const local = await loadProfileData(profileId);
    environments = local.environments;
    isNew = projects.length === 0;
    if (isNew) {
      projects = [];
    } else {
      await persistProjects(profileId, projects);
    }
  } else {
    const data = await loadProfileData(profileId);
    projects = data.projects;
    environments = data.environments;
    isNew = data.isNew;
  }

  const savedSession = await loadSession(profileId);
  const cookieStore = await loadCookies(profileId);

  const session = savedSession
    ? reconcileSession(savedSession, projects, environments, emptyTabName)
    : {
        tabs: [createEmptyRequestTab(emptyTabName)],
        activeTabId: '',
        activeEnvironmentId: environments[0]?.id ?? null,
      };
  if (!session.activeTabId) {
    session.activeTabId = session.tabs[session.tabs.length - 1].id;
  }

  return {
    projects,
    environments,
    tabs: session.tabs,
    activeTabId: session.activeTabId,
    activeEnvironmentId: session.activeEnvironmentId ?? environments[0]?.id ?? null,
    cookieStore,
    activeProfileId: profileId,
  };
}

async function loadProfileData(profileId: string): Promise<{
  projects: Project[];
  environments: Environment[];
  isNew: boolean;
}> {
  try {
    const { GetProjects, GetEnvironments } = await import('../../wailsjs/go/main/App');
    const [projectsRaw, envsRaw] = await Promise.all([
      GetProjects(profileId),
      GetEnvironments(profileId),
    ]);

    let projects = defaultProjects;
    let environments = defaultEnvironments;
    let isNew = !projectsRaw;

    if (projectsRaw) {
      const parsed = JSON.parse(projectsRaw) as Project[];
      if (Array.isArray(parsed) && parsed.length > 0) projects = parsed;
    }
    if (envsRaw) {
      const parsed = JSON.parse(envsRaw) as Environment[];
      if (Array.isArray(parsed) && parsed.length > 0) environments = parsed;
    }

    return { projects, environments, isNew };
  } catch {
    return { projects: defaultProjects, environments: defaultEnvironments, isNew: true };
  }
}

async function persistProjects(profileId: string, projects: Project[]) {
  try {
    const { SaveProjects } = await import('../../wailsjs/go/main/App');
    await SaveProjects(profileId, JSON.stringify(projects));
  } catch {
    // outside wails
  }
}

async function persistEnvironments(profileId: string, environments: Environment[]) {
  try {
    const { SaveEnvironments } = await import('../../wailsjs/go/main/App');
    await SaveEnvironments(profileId, JSON.stringify(environments));
  } catch {
    // outside wails
  }
}

async function loadSession(profileId: string): Promise<ProfileSession | null> {
  try {
    const { GetSession } = await import('../../wailsjs/go/main/App');
    const raw = await GetSession(profileId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ProfileSession;
    if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function persistSession(profileId: string, session: ProfileSession) {
  try {
    const { SaveSession } = await import('../../wailsjs/go/main/App');
    await SaveSession(profileId, JSON.stringify(session));
  } catch {
    // outside wails
  }
}

async function loadCookies(profileId: string): Promise<CookieStore> {
  try {
    const { GetCookies } = await import('../../wailsjs/go/main/App');
    const raw = await GetCookies(profileId);
    if (!raw) return emptyCookieStore();
    const parsed = JSON.parse(raw) as CookieStore;
    return {
      domains: Array.isArray(parsed.domains) ? parsed.domains : [],
      cookies: Array.isArray(parsed.cookies) ? parsed.cookies : [],
      domainAllowlist: Array.isArray(parsed.domainAllowlist) ? parsed.domainAllowlist : [],
    };
  } catch {
    return emptyCookieStore();
  }
}

async function persistCookies(profileId: string, store: CookieStore) {
  try {
    const { SaveCookies } = await import('../../wailsjs/go/main/App');
    await SaveCookies(profileId, JSON.stringify(store));
  } catch {
    // outside wails
  }
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    profiles: [defaultProfile],
    activeProfileId: 'my',
    projects: defaultProjects,
    environments: defaultEnvironments,
    activeEnvironmentId: 'dev',
    tabs: [],
    activeTabId: '',
    settings: { language: 'ru', myProfileName: 'My' },
    cookieStore: emptyCookieStore(),
  });
  const sessionLoadedRef = useRef(false);
  const sessionRef = useRef<ProfileSession | null>(null);
  const cookiesLoadedRef = useRef(false);
  const cookieStoreRef = useRef<CookieStore>(emptyCookieStore());

  const t = translate(state.settings.language);
  const activeProfile = state.profiles.find((p) => p.id === state.activeProfileId) ?? defaultProfile;

  const persistSettings = useCallback(async (settings: AppSettings) => {
    try {
      const { SaveSettings } = await import('../../wailsjs/go/main/App');
      const { main } = await import('../../wailsjs/go/models');
      await SaveSettings(new main.Settings(settings));
    } catch {
      // outside wails
    }
  }, []);

  const withPersistProjects = useCallback(
    (projects: Project[]) => {
      persistProjects(state.activeProfileId, projects);
      setState((s) => ({ ...s, projects }));
    },
    [state.activeProfileId]
  );

  useEffect(() => {
    (async () => {
      let settings: AppSettings = { language: 'ru', myProfileName: 'My' };
      try {
        const { GetSettings } = await import('../../wailsjs/go/main/App');
        const raw = await GetSettings();
        if (raw) {
          settings = {
            language: raw.language === 'en' ? 'en' : 'ru',
            myProfileName: raw.myProfileName || 'My',
          };
        }
      } catch {
        // outside wails
      }

      const remoteProfiles = await loadRemoteProfiles();
      const { projects, environments, isNew } = await loadProfileData('my');
      const savedSession = await loadSession('my');
      const cookieStore = await loadCookies('my');
      const emptyTabName = translate(settings.language).tabs.newRequest;

      const session = savedSession
        ? reconcileSession(savedSession, projects, environments, emptyTabName)
        : {
            tabs: [createEmptyRequestTab(emptyTabName)],
            activeTabId: '',
            activeEnvironmentId: environments[0]?.id ?? null,
          };
      if (!session.activeTabId) {
        session.activeTabId = session.tabs[session.tabs.length - 1].id;
      }

      sessionRef.current = session;
      sessionLoadedRef.current = true;
      cookieStoreRef.current = cookieStore;
      cookiesLoadedRef.current = true;

      setState((s) => ({
        ...s,
        settings,
        projects,
        environments,
        tabs: session.tabs,
        activeTabId: session.activeTabId,
        activeEnvironmentId: session.activeEnvironmentId ?? environments[0]?.id ?? null,
        cookieStore,
        profiles: [
          ...s.profiles.map((p) =>
            p.id === 'my'
              ? {
                  ...p,
                  name: settings.myProfileName,
                  avatarLetter: settings.myProfileName[0]?.toUpperCase() || 'M',
                }
              : p
          ),
          ...remoteProfiles.filter((rp) => !s.profiles.some((p) => p.id === rp.id)),
        ],
      }));

      if (isNew) {
        persistProjects('my', defaultProjects);
        persistEnvironments('my', defaultEnvironments);
      }
    })();
  }, []);

  useEffect(() => {
    if (!sessionLoadedRef.current) return;

    const session: ProfileSession = {
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      activeEnvironmentId: state.activeEnvironmentId,
    };
    sessionRef.current = session;

    const timer = window.setTimeout(() => {
      void persistSession(state.activeProfileId, session);
    }, 200);

    const flush = () => {
      window.clearTimeout(timer);
      void persistSession(state.activeProfileId, sessionRef.current!);
    };

    window.addEventListener('beforeunload', flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeunload', flush);
      void persistSession(state.activeProfileId, session);
    };
  }, [state.tabs, state.activeTabId, state.activeEnvironmentId, state.activeProfileId]);

  useEffect(() => {
    if (!cookiesLoadedRef.current) return;

    cookieStoreRef.current = state.cookieStore;

    const timer = window.setTimeout(() => {
      void persistCookies(state.activeProfileId, state.cookieStore);
    }, 200);

    const flush = () => {
      window.clearTimeout(timer);
      void persistCookies(state.activeProfileId, cookieStoreRef.current);
    };

    window.addEventListener('beforeunload', flush);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeunload', flush);
      void persistCookies(state.activeProfileId, state.cookieStore);
    };
  }, [state.cookieStore, state.activeProfileId]);

  const setLanguage = useCallback(
    (language: 'ru' | 'en') => {
      setState((s) => {
        const settings = { ...s.settings, language };
        persistSettings(settings);
        return { ...s, settings };
      });
    },
    [persistSettings]
  );

  const setMyProfileName = useCallback(
    (myProfileName: string) => {
      setState((s) => {
        const settings = { ...s.settings, myProfileName };
        persistSettings(settings);
        return {
          ...s,
          settings,
          profiles: s.profiles.map((p) =>
            p.id === 'my'
              ? { ...p, name: myProfileName, avatarLetter: myProfileName[0]?.toUpperCase() || 'M' }
              : p
          ),
        };
      });
    },
    [persistSettings]
  );

  const switchProfile = useCallback((id: string) => {
    setState((s) => {
      if (s.activeProfileId === id) return s;
      const profile = s.profiles.find((p) => p.id === id);
      void (async () => {
        const patch = await activateProfile(id, profile, s.settings.language);
        setState((current) => ({ ...current, ...patch }));
      })();
      return { ...s, activeProfileId: id };
    });
  }, []);

  const addRemoteProfile = useCallback(async (result: {
    profileId: string;
    serverUrl: string;
    serverName: string;
    displayName: string;
  }) => {
    const profile = profileFromAuthResult(result);
    const patch = await activateProfile(profile.id, profile, state.settings.language);
    setState((s) => ({
      ...s,
      ...patch,
      profiles: s.profiles.some((p) => p.id === profile.id)
        ? s.profiles.map((p) => (p.id === profile.id ? profile : p))
        : [...s.profiles, profile],
    }));
  }, [state.settings.language]);

  const signIn = useCallback(
    async (serverUrl: string, email: string, password: string) => {
      const { AuthLogin } = await import('../../wailsjs/go/main/App');
      const result = await AuthLogin(serverUrl, email, password);
      await addRemoteProfile(result);
    },
    [addRemoteProfile]
  );

  const redeemInvite = useCallback(
    async (inviteUrl: string, password: string) => {
      const { ParseInviteURL, AuthRedeemInvite, ClearPendingInvite } = await import(
        '../../wailsjs/go/main/App'
      );
      const pending = await ParseInviteURL(inviteUrl);
      if (!pending) throw new Error('Invalid invite URL');
      const result = await AuthRedeemInvite(pending.serverUrl, pending.token, password);
      await ClearPendingInvite();
      await addRemoteProfile(result);
    },
    [addRemoteProfile]
  );

  const signOut = useCallback(async (profileId: string) => {
    const { AuthSignOut } = await import('../../wailsjs/go/main/App');
    await AuthSignOut(profileId);
    setState((s) => {
      const profiles = s.profiles.filter((p) => p.id !== profileId);
      if (s.activeProfileId !== profileId) {
        return { ...s, profiles };
      }
      void (async () => {
        const myProfile = profiles.find((p) => p.id === 'my') ?? defaultProfile;
        const patch = await activateProfile('my', myProfile, s.settings.language);
        setState((current) => ({ ...current, ...patch, profiles }));
      })();
      return { ...s, profiles, activeProfileId: 'my' };
    });
  }, []);

  const checkPendingInvite = useCallback(async () => {
    try {
      const { GetPendingInvite } = await import('../../wailsjs/go/main/App');
      const pending = await GetPendingInvite();
      if (!pending) return null;
      return {
        serverUrl: pending.serverUrl,
        email: pending.email,
        inviteUrl: `egogo://auth/invite?token=${encodeURIComponent(pending.token)}&server=${encodeURIComponent(pending.serverUrl)}`,
      };
    } catch {
      return null;
    }
  }, []);

  const openSettings = useCallback(() => {
    setState((s) => {
      const existing = s.tabs.find((tab) => tab.kind === 'settings');
      if (existing) return { ...s, activeTabId: existing.id };
      const tab: RequestTab = {
        id: 'settings',
        name: t.tabs.settings,
        method: 'GET',
        url: '',
        kind: 'settings',
      };
      return { ...s, tabs: [...s.tabs, tab], activeTabId: tab.id };
    });
  }, [t.tabs.settings]);

  const openEnvironmentEditor = useCallback((environmentId: string) => {
    setState((s) => {
      const env = s.environments.find((e) => e.id === environmentId);
      const tabId = `env-${environmentId}`;
      const existing = s.tabs.find((tab) => tab.id === tabId);
      if (existing) return { ...s, activeTabId: tabId };
      const tab: RequestTab = {
        id: tabId,
        name: env?.name ?? 'Environment',
        method: 'GET',
        url: '',
        kind: 'environment',
        environmentId,
      };
      return { ...s, tabs: [...s.tabs, tab], activeTabId: tabId };
    });
  }, []);

  const saveEnvironment = useCallback(async (environmentId: string, variables: Record<string, string>) => {
    setState((s) => {
      const environments = s.environments.map((e) =>
        e.id === environmentId ? { ...e, variables } : e
      );
      persistEnvironments(s.activeProfileId, environments);
      return { ...s, environments };
    });
  }, []);

  const openTab = useCallback((tab: Omit<RequestTab, 'id'> & { id?: string }) => {
    setState((s) => {
      const tabId = tab.requestId ? `tab-${tab.requestId}` : tab.id ?? `tab-${Date.now()}`;
      const existing = s.tabs.find((t) => t.id === tabId);
      if (existing) return { ...s, activeTabId: tabId };

      let url = tab.url;
      let params = tab.params;
      const hasParams = params?.some((p) => p.key.trim());
      if (!hasParams && url.includes('?')) {
        const parsed = applyUrlEdit(url);
        url = parsed.url;
        params = parsed.params;
      }

      return {
        ...s,
        tabs: [
          ...s.tabs,
          {
            ...tab,
            url,
            params,
            id: tabId,
            kind: tab.kind ?? 'request',
            body: tab.body ?? '',
            bodyState: tab.bodyState,
          },
        ],
        activeTabId: tabId,
      };
    });
  }, []);

  const closeTab = useCallback(
    (id: string) => {
      setState((s) => {
        const tabs = s.tabs.filter((t) => t.id !== id);
        if (tabs.length === 0) {
          const fallback = createEmptyRequestTab(t.tabs.newRequest);
          return { ...s, tabs: [fallback], activeTabId: fallback.id };
        }
        const activeTabId = s.activeTabId === id ? tabs[tabs.length - 1].id : s.activeTabId;
        return { ...s, tabs, activeTabId };
      });
    },
    [t.tabs.newRequest]
  );

  const setActiveTab = useCallback((id: string) => {
    setState((s) => ({ ...s, activeTabId: id }));
  }, []);

  const setActiveEnvironment = useCallback((id: string | null) => {
    setState((s) => ({ ...s, activeEnvironmentId: id }));
  }, []);

  const toggleProject = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      projects: s.projects.map((p) => (p.id === id ? { ...p, expanded: !p.expanded } : p)),
    }));
  }, []);

  const createProject = useCallback(async (): Promise<void> => {
    const name = t.sidebar.newProject;
    let id = newId('proj');
    if (activeProfile.type === 'remote') {
      try {
        const { CreateRemoteProject } = await import('../../wailsjs/go/main/App');
        const raw = await CreateRemoteProject(
          state.activeProfileId,
          name,
          JSON.stringify({ children: [] })
        );
        const meta = raw ? (JSON.parse(raw) as { id?: string }) : null;
        if (meta?.id) id = meta.id;
      } catch {
        // Сервер недоступен/нет прав — создаём локально.
      }
    }
    const project: Project = { id, name, expanded: true, children: [] };
    const projects = [...state.projects, project];
    await persistProjects(state.activeProfileId, projects);
    setState((s) => ({ ...s, projects }));
  }, [state.projects, state.activeProfileId, activeProfile.type, t.sidebar.newProject]);

  const updateActiveTab = useCallback((patch: Partial<RequestTab>) => {
    setState((s) => ({
      ...s,
      tabs: s.tabs.map((tab) =>
        tab.id === s.activeTabId ? { ...tab, ...patch, dirty: true } : tab
      ),
    }));
  }, []);

  const saveActiveTab = useCallback(async (): Promise<boolean> => {
    const tab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!tab || tab.kind !== 'request') return false;

    let projects = [...state.projects];
    let requestId = tab.requestId;
    let projectId = tab.projectId;

    if (requestId) {
      projects = updateRequestInTree(projects, requestId, {
        name: tab.name,
        method: tab.method,
        url: tab.url,
        body: tab.bodyState?.mode === 'raw' ? tab.bodyState.raw : tab.body ?? '',
        bodyState: tab.bodyState,
        params: tab.params,
        headerRows: tab.headerRows,
        auth: tab.auth,
      });
    } else {
      const parent = getDefaultSaveParent(projects);
      if (!parent) return false;
      const request = createDefaultRequest(tab.name || t.tabs.newRequest);
      request.method = tab.method;
      request.url = tab.url;
      request.body = tab.bodyState?.mode === 'raw' ? tab.bodyState.raw : tab.body ?? '';
      request.bodyState = tab.bodyState;
      request.params = tab.params;
      request.headerRows = tab.headerRows;
      request.auth = tab.auth;
      requestId = request.id;
      projectId = parent.projectId;
      projects = addRequestTo(projects, parent, request);
    }

    await persistProjects(state.activeProfileId, projects);
    setState((s) => ({
      ...s,
      projects,
      tabs: s.tabs.map((t) =>
        t.id === s.activeTabId
          ? { ...t, requestId, projectId, dirty: false, name: tab.name || t.name }
          : t
      ),
    }));
    return true;
  }, [state.activeProfileId, state.activeTabId, state.projects, state.tabs, t.tabs.newRequest]);

  const renameNode = useCallback(
    (ref: NodeRef, name: string) => {
      const projects = renameNodeInTree(state.projects, ref, name);
      withPersistProjects(projects);
      if (ref.nodeType === 'request') {
        setState((s) => ({
          ...s,
          projects,
          tabs: s.tabs.map((tab) =>
            tab.requestId === ref.nodeId ? { ...tab, name } : tab
          ),
        }));
      } else {
        setState((s) => ({ ...s, projects }));
      }
    },
    [state.projects, withPersistProjects]
  );

  const moveTreeNode = useCallback(
    (source: NodeRef, targetParent: NodeRef) => {
      const projects = moveNodeInTree(state.projects, source, targetParent);
      if (!projects) return;
      withPersistProjects(projects);
    },
    [state.projects, withPersistProjects]
  );

  const treeAction = useCallback(
    (ref: NodeRef, action: import('../types').ContextMenuAction) => {
      switch (action) {
        case 'rename':
          return;
        case 'copy': {
          const data = getNodeForCopy(state.projects, ref);
          if (!data) return;
          (async () => {
            try {
              const { SetClipboard } = await import('../../wailsjs/go/main/App');
              await SetClipboard(JSON.stringify(data, null, 2));
            } catch {
              await navigator.clipboard?.writeText(JSON.stringify(data, null, 2));
            }
          })();
          return;
        }
        case 'duplicate': {
          const projects = duplicateNodeInTree(state.projects, ref);
          withPersistProjects(projects);
          return;
        }
        case 'delete': {
          const projects = deleteNodeFromTree(state.projects, ref);
          persistProjects(state.activeProfileId, projects);
          setState((s) => ({
            ...s,
            projects,
            tabs:
              ref.nodeType === 'request'
                ? s.tabs.filter((tab) => tab.requestId !== ref.nodeId)
                : s.tabs,
          }));
          return;
        }
        case 'addRequest': {
          const request = createDefaultRequest(t.tabs.newRequest);
          const projects = addRequestTo(state.projects, ref, request);
          withPersistProjects(projects);
          openTab({
            name: request.name,
            method: request.method,
            url: request.url,
            body: request.body,
            requestId: request.id,
            projectId: ref.projectId,
            kind: 'request',
          });
          return;
        }
        case 'addFolder': {
          const folder = createDefaultFolder();
          const projects = addFolderTo(state.projects, ref, folder);
          withPersistProjects(projects);
          return;
        }
      }
    },
    [state.projects, t.tabs.newRequest, withPersistProjects, openTab]
  );

  const updateCookieStore = useCallback((updater: (store: CookieStore) => CookieStore) => {
    setState((s) => ({ ...s, cookieStore: updater(s.cookieStore) }));
  }, []);

  const addCookieDomain = useCallback(
    (domain: string) => updateCookieStore((store) => addDomainToStore(store, domain)),
    [updateCookieStore]
  );

  const removeCookieDomain = useCallback(
    (domain: string) => updateCookieStore((store) => removeDomainFromStore(store, domain)),
    [updateCookieStore]
  );

  const upsertCookie = useCallback(
    (cookie: StoredCookie) => updateCookieStore((store) => upsertCookieInStore(store, cookie)),
    [updateCookieStore]
  );

  const deleteCookie = useCallback(
    (cookieId: string) => updateCookieStore((store) => deleteCookieFromStore(store, cookieId)),
    [updateCookieStore]
  );

  const clearAllCookies = useCallback(
    () => updateCookieStore(() => clearCookieStore()),
    [updateCookieStore]
  );

  const updateCookieAllowlist = useCallback(
    (allowlist: string[]) =>
      updateCookieStore((store) => ({ ...store, domainAllowlist: allowlist })),
    [updateCookieStore]
  );

  const applyResponseCookies = useCallback(
    (cookies: ResponseCookie[], requestUrl: string) =>
      updateCookieStore((store) => mergeResponseCookies(store, cookies, requestUrl)),
    [updateCookieStore]
  );

  return (
    <AppContext.Provider
      value={{
        ...state,
        t,
        activeProfile,
        setLanguage,
        setMyProfileName,
        switchProfile,
        openSettings,
        openEnvironmentEditor,
        saveEnvironment,
        openTab,
        closeTab,
        setActiveTab,
        setActiveEnvironment,
        toggleProject,
        createProject,
        updateActiveTab,
        saveActiveTab,
        treeAction,
        renameNode,
        moveTreeNode,
        addCookieDomain,
        removeCookieDomain,
        upsertCookie,
        deleteCookie,
        clearAllCookies,
        updateCookieAllowlist,
        applyResponseCookies,
        signIn,
        redeemInvite,
        signOut,
        checkPendingInvite,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function methodColor(method: HttpMethod): string {
  const colors: Record<HttpMethod, string> = {
    GET: 'var(--method-get)',
    POST: 'var(--method-post)',
    PUT: 'var(--method-put)',
    PATCH: 'var(--method-patch)',
    DELETE: 'var(--method-delete)',
    HEAD: 'var(--method-head)',
    OPTIONS: 'var(--method-options)',
  };
  return colors[method];
}
