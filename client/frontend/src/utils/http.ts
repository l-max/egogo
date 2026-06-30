import type { KeyValueRow, RequestAuth, BodyFormat, HttpResponseData } from '../types/request';
import { emptyRow } from '../types/request';

export function resolveVariables(raw: string, variables: Record<string, string>): string {
  return raw.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
}

/** Split URL into path (may include hash) and query string */
export function splitUrlQuery(url: string): { base: string; query: string } {
  const hashIdx = url.indexOf('#');
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const beforeHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const qIdx = beforeHash.indexOf('?');
  if (qIdx < 0) return { base: url, query: '' };
  return {
    base: beforeHash.slice(0, qIdx) + hash,
    query: beforeHash.slice(qIdx + 1),
  };
}

export function queryToRows(query: string): KeyValueRow[] {
  if (!query.trim()) return [emptyRow()];
  return query.split('&').filter(Boolean).map((pair) => {
    const eq = pair.indexOf('=');
    if (eq < 0) {
      return { key: safeDecode(pair), value: '', enabled: true };
    }
    return {
      key: safeDecode(pair.slice(0, eq)),
      value: safeDecode(pair.slice(eq + 1)),
      enabled: true,
    };
  });
}

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s.replace(/\+/g, ' '));
  } catch {
    return s;
  }
}

/** Display URL in address bar (readable, no encoding) */
export function formatUrlWithParams(baseUrl: string, params: KeyValueRow[]): string {
  const active = params.filter((p) => p.enabled && p.key.trim());
  const { base } = splitUrlQuery(baseUrl);
  if (active.length === 0) return base;

  const qs = active
    .map((p) => {
      const k = p.key.trim();
      return p.value === '' ? k : `${k}=${p.value}`;
    })
    .join('&');
  return `${base}?${qs}`;
}

export function buildUrl(baseUrl: string, params: KeyValueRow[]): string {
  const active = params.filter((p) => p.enabled && p.key.trim());
  const { base } = splitUrlQuery(baseUrl);
  if (active.length === 0) return base;

  // URL API only for real URLs without template placeholders
  if (!base.includes('{{') && /^https?:\/\//i.test(base)) {
    try {
      const parsed = new URL(base);
      for (const p of active) {
        parsed.searchParams.set(p.key.trim(), p.value);
      }
      return parsed.toString();
    } catch {
      /* fall through to string concat */
    }
  }

  const qs = active
    .map((p) => `${encodeURIComponent(p.key.trim())}=${encodeURIComponent(p.value)}`)
    .join('&');
  return `${base}?${qs}`;
}

export function applyUrlEdit(rawUrl: string): { url: string; params: KeyValueRow[] } {
  const { base, query } = splitUrlQuery(rawUrl);
  return {
    url: base,
    params: queryToRows(query),
  };
}

export function buildHeaders(headerRows: KeyValueRow[], auth: RequestAuth): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const row of headerRows) {
    if (row.enabled && row.key.trim()) {
      headers[row.key.trim()] = row.value;
    }
  }
  if (auth.type === 'bearer' && auth.token?.trim()) {
    headers['Authorization'] = `Bearer ${auth.token.trim()}`;
  }
  if (auth.type === 'basic' && auth.username !== undefined) {
    const encoded = btoa(`${auth.username}:${auth.password ?? ''}`);
    headers['Authorization'] = `Basic ${encoded}`;
  }
  return headers;
}

export function headerRowsFromRecord(headers?: Record<string, string>): KeyValueRow[] {
  if (!headers || Object.keys(headers).length === 0) return [{ key: '', value: '', enabled: true }];
  return Object.entries(headers).map(([key, value]) => ({ key, value, enabled: true }));
}

export function detectBodyFormat(contentType: string | undefined, body: string): BodyFormat {
  const ct = (contentType ?? '').toLowerCase();
  if (ct.includes('json') || ct.includes('javascript')) {
    try {
      JSON.parse(body);
      return 'json';
    } catch {
      return ct.includes('javascript') ? 'javascript' : 'json';
    }
  }
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.includes('yaml') || ct.includes('yml')) return 'yaml';
  if (ct.includes('markdown')) return 'markdown';
  if (body.trim().startsWith('{') || body.trim().startsWith('[')) {
    try {
      JSON.parse(body);
      return 'json';
    } catch {
      /* ignore */
    }
  }
  if (body.trim().startsWith('<')) return 'html';
  return 'json';
}

export function formatResponseBody(body: string, format: BodyFormat, pretty = false): string {
  if (!body) return '';
  if (!pretty) return body;

  switch (format) {
    case 'json':
      try {
        return JSON.stringify(JSON.parse(body), null, 2);
      } catch {
        return body;
      }
    case 'xml':
    case 'html':
      return prettyPrintMarkup(body);
    case 'javascript':
      try {
        return body
          .replace(/;\s*(?=\S)/g, ';\n')
          .replace(/\{\s*/g, ' {\n  ')
          .replace(/\}\s*/g, '\n}\n')
          .replace(/,\s*(?=\S)/g, ',\n  ');
      } catch {
        return body;
      }
    case 'yaml':
    case 'markdown':
    case 'preview':
    default:
      return body;
  }
}

function prettyPrintMarkup(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return raw;

  const lines = trimmed.replace(/>\s*</g, '>\n<').split('\n');
  let indent = 0;
  const result: string[] = [];

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t.startsWith('</')) indent = Math.max(0, indent - 1);
    result.push('  '.repeat(indent) + t);
    if (
      t.startsWith('<') &&
      !t.startsWith('</') &&
      !t.startsWith('<?') &&
      !t.startsWith('<!') &&
      !t.endsWith('/>') &&
      !t.includes('</')
    ) {
      indent++;
    }
  }

  return result.join('\n');
}

export function formatHttpStatus(statusCode: number, status: string): string {
  const trimmed = status.trim();
  if (!trimmed) return String(statusCode);
  if (trimmed.startsWith(`${statusCode} `) || trimmed === String(statusCode)) {
    return trimmed;
  }
  return `${statusCode} ${trimmed}`;
}

export function responseSummary(data: HttpResponseData | null): string {
  if (!data) return '';
  if (data.error) return `Error: ${data.error}`;
  return `${formatHttpStatus(data.statusCode, data.status)} · ${data.durationMs} ms`;
}

export function statusColor(code: number): string {
  if (code >= 200 && code < 300) return 'var(--method-post)';
  if (code >= 300 && code < 400) return 'var(--method-put)';
  if (code >= 400) return 'var(--method-delete)';
  return 'var(--text-secondary)';
}
