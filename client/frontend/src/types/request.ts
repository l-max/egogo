export interface KeyValueRow {
  key: string;
  value: string;
  enabled: boolean;
}

export interface RequestAuth {
  type: 'none' | 'bearer' | 'basic';
  token?: string;
  username?: string;
  password?: string;
}

export type BodyFormat = 'json' | 'xml' | 'html' | 'yaml' | 'javascript' | 'markdown' | 'preview';

export type RequestBodyMode =
  | 'none'
  | 'form-data'
  | 'urlencoded'
  | 'raw'
  | 'binary'
  | 'graphql';

export type RequestRawLanguage = 'text' | 'json' | 'javascript' | 'html' | 'xml';

export interface RequestBodyState {
  mode: RequestBodyMode;
  raw: string;
  rawLanguage: RequestRawLanguage;
  formData: KeyValueRow[];
  urlencoded: KeyValueRow[];
  graphqlQuery: string;
  graphqlVariables: string;
  binaryFileName: string;
  binaryBase64: string;
}

export type RequestSubTab = 'params' | 'headers' | 'body' | 'authorization';
export type ResponseSubTab = 'body' | 'headers' | 'cookies';

export interface ResponseCookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  raw?: string;
}

export interface HttpResponseData {
  statusCode: number;
  status: string;
  durationMs: number;
  headers: Record<string, string>;
  cookies: ResponseCookie[];
  body: string;
  error?: string;
}

export function emptyRow(): KeyValueRow {
  return { key: '', value: '', enabled: true };
}

export function ensureRows(rows?: KeyValueRow[]): KeyValueRow[] {
  if (!rows || rows.length === 0) return [emptyRow()];
  return rows;
}

export const defaultAuth = (): RequestAuth => ({ type: 'none' });

export function defaultRequestBodyState(raw = ''): RequestBodyState {
  return {
    mode: 'raw',
    raw,
    rawLanguage: 'json',
    formData: [emptyRow()],
    urlencoded: [emptyRow()],
    graphqlQuery: '',
    graphqlVariables: '{\n\n}',
    binaryFileName: '',
    binaryBase64: '',
  };
}

export function resolveBodyState(tab: {
  body?: string;
  bodyState?: RequestBodyState;
}): RequestBodyState {
  if (tab.bodyState) {
    return {
      ...defaultRequestBodyState(),
      ...tab.bodyState,
      formData: ensureRows(tab.bodyState.formData),
      urlencoded: ensureRows(tab.bodyState.urlencoded),
    };
  }
  return defaultRequestBodyState(tab.body ?? '');
}
