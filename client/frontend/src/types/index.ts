export type ProfileType = 'local' | 'remote' | 'git';

export interface Profile {
  id: string;
  name: string;
  serverName?: string;
  serverUrl?: string;
  type: ProfileType;
  avatarLetter: string;
  avatarColor: string;
  isLoggedIn: boolean;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

export type { CookieStore, StoredCookie } from './cookies';
export type { KeyValueRow, RequestAuth, BodyFormat, RequestSubTab, ResponseSubTab, RequestBodyMode, RequestRawLanguage, RequestBodyState } from './request';
import type { KeyValueRow, RequestAuth, RequestBodyState } from './request';
import type { CookieStore } from './cookies';

export interface RequestItem {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  body?: string;
  bodyState?: RequestBodyState;
  params?: KeyValueRow[];
  headerRows?: KeyValueRow[];
  auth?: RequestAuth;
  /** @deprecated use headerRows */
  headers?: Record<string, string>;
}

export interface FolderItem {
  id: string;
  name: string;
  children: TreeNode[];
}

export type TreeNode =
  | { type: 'folder'; data: FolderItem }
  | { type: 'request'; data: RequestItem };

export interface Project {
  id: string;
  name: string;
  expanded: boolean;
  children: TreeNode[];
}

export interface Environment {
  id: string;
  name: string;
  variables: Record<string, string>;
}

export interface RequestTab {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  body?: string;
  bodyState?: RequestBodyState;
  params?: KeyValueRow[];
  headerRows?: KeyValueRow[];
  auth?: RequestAuth;
  kind: 'request' | 'settings' | 'environment';
  requestId?: string;
  projectId?: string;
  environmentId?: string;
  dirty?: boolean;
}

export interface AppSettings {
  language: 'ru' | 'en';
  myProfileName: string;
}

export interface ProfileSession {
  tabs: RequestTab[];
  activeTabId: string;
  activeEnvironmentId: string | null;
}

export interface AppState {
  profiles: Profile[];
  activeProfileId: string;
  projects: Project[];
  environments: Environment[];
  activeEnvironmentId: string | null;
  tabs: RequestTab[];
  activeTabId: string;
  settings: AppSettings;
  cookieStore: CookieStore;
}

export type ContextMenuAction =
  | 'rename'
  | 'copy'
  | 'duplicate'
  | 'delete'
  | 'addRequest'
  | 'addFolder';
