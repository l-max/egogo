import type { KeyValueRow, RequestBodyState, RequestRawLanguage } from '../types/request';
import { formatResponseBody } from './http';
import { beautifyJson } from './jsonBeautify';

export interface RequestBodyPayload {
  body: string;
  bodyIsBase64: boolean;
  contentType?: string;
}

function activeRows(rows: KeyValueRow[]): KeyValueRow[] {
  return rows.filter((row) => row.enabled && row.key.trim());
}

function buildMultipartBody(rows: KeyValueRow[], boundary: string): string {
  const parts: string[] = [];
  for (const row of rows) {
    const key = row.key.trim();
    parts.push(`--${boundary}`);
    parts.push(`Content-Disposition: form-data; name="${key}"`);
    parts.push('');
    parts.push(row.value);
  }
  parts.push(`--${boundary}--`);
  return parts.join('\r\n');
}

function buildUrlencodedBody(rows: KeyValueRow[]): string {
  return rows
    .map((row) => {
      const key = row.key.trim();
      return `${encodeURIComponent(key)}=${encodeURIComponent(row.value)}`;
    })
    .join('&');
}

function rawContentType(language: RequestRawLanguage): string {
  switch (language) {
    case 'json':
      return 'application/json';
    case 'javascript':
      return 'application/javascript';
    case 'html':
      return 'text/html';
    case 'xml':
      return 'application/xml';
    case 'text':
    default:
      return 'text/plain';
  }
}

export function buildRequestBodyPayload(
  bodyState: RequestBodyState,
  resolve: (value: string) => string
): RequestBodyPayload {
  switch (bodyState.mode) {
    case 'none':
      return { body: '', bodyIsBase64: false };
    case 'form-data': {
      const rows = activeRows(bodyState.formData).map((row) => ({
        ...row,
        key: resolve(row.key),
        value: resolve(row.value),
      }));
      if (rows.length === 0) return { body: '', bodyIsBase64: false };
      const boundary = `----egogo${Date.now().toString(16)}`;
      return {
        body: buildMultipartBody(rows, boundary),
        bodyIsBase64: false,
        contentType: `multipart/form-data; boundary=${boundary}`,
      };
    }
    case 'urlencoded': {
      const rows = activeRows(bodyState.urlencoded).map((row) => ({
        ...row,
        key: resolve(row.key),
        value: resolve(row.value),
      }));
      return {
        body: rows.length > 0 ? buildUrlencodedBody(rows) : '',
        bodyIsBase64: false,
        contentType: 'application/x-www-form-urlencoded',
      };
    }
    case 'raw':
      return {
        body: resolve(bodyState.raw),
        bodyIsBase64: false,
        contentType: rawContentType(bodyState.rawLanguage),
      };
    case 'binary':
      return {
        body: bodyState.binaryBase64,
        bodyIsBase64: Boolean(bodyState.binaryBase64),
        contentType: 'application/octet-stream',
      };
    case 'graphql': {
      let variables: unknown = {};
      const varsRaw = bodyState.graphqlVariables.trim();
      if (varsRaw) {
        try {
          variables = JSON.parse(resolve(varsRaw));
        } catch {
          variables = {};
        }
      }
      const payload = {
        query: resolve(bodyState.graphqlQuery),
        variables,
      };
      return {
        body: JSON.stringify(payload),
        bodyIsBase64: false,
        contentType: 'application/json',
      };
    }
    default:
      return { body: '', bodyIsBase64: false };
  }
}

export function beautifyRawBody(raw: string, language: RequestRawLanguage): string {
  const trimmed = raw.trim();

  if (!trimmed) {
    if (language === 'json') return '{\n}\n';
    return raw;
  }

  switch (language) {
    case 'json':
      return beautifyJson(trimmed);
    case 'javascript':
      return formatResponseBody(trimmed, 'javascript', true);
    case 'html':
      return formatResponseBody(trimmed, 'html', true);
    case 'xml':
      return formatResponseBody(trimmed, 'xml', true);
    case 'text':
    default:
      return raw;
  }
}

export function applyBodyContentType(
  headers: Record<string, string>,
  contentType?: string
): Record<string, string> {
  if (!contentType) return headers;
  const hasContentType = Object.keys(headers).some((key) => key.toLowerCase() === 'content-type');
  if (hasContentType) return headers;
  return { ...headers, 'Content-Type': contentType };
}
