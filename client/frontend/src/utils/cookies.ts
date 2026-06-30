import type { ResponseCookie } from '../types/request';
import type { CookieStore, StoredCookie } from '../types/cookies';

export function normalizeDomain(domain: string): string {
  return domain
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/:\d+$/, '');
}

export function extractHost(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('{{')) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return normalizeDomain(new URL(withProtocol).hostname);
  } catch {
    return null;
  }
}

export function extractPath(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes('{{')) return '/';
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const path = new URL(withProtocol).pathname;
    return path || '/';
  } catch {
    return '/';
  }
}

export function domainMatches(cookieDomain: string, requestHost: string): boolean {
  const host = normalizeDomain(requestHost);
  const domain = normalizeDomain(cookieDomain);
  if (!host || !domain) return false;
  if (host === domain) return true;
  if (domain.startsWith('.')) {
    return host === domain.slice(1) || host.endsWith(domain);
  }
  return host.endsWith(`.${domain}`);
}

export function pathMatches(cookiePath: string, requestPath: string): boolean {
  const path = cookiePath || '/';
  const req = requestPath || '/';
  if (path === '/') return true;
  return req === path || req.startsWith(path.endsWith('/') ? path : `${path}/`);
}

export function hostAllowedByAllowlist(host: string, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true;
  const normalized = normalizeDomain(host);
  return allowlist.some((entry) => domainMatches(entry, normalized));
}

export function getCookiesForRequest(store: CookieStore, url: string): StoredCookie[] {
  const host = extractHost(url);
  if (!host) return [];
  const path = extractPath(url);

  return store.cookies.filter(
    (cookie) =>
      cookie.enabled &&
      cookie.name.trim() &&
      domainMatches(cookie.domain, host) &&
      pathMatches(cookie.path, path)
  );
}

export function buildCookieHeader(cookies: StoredCookie[]): string {
  return cookies.map((c) => `${c.name}=${c.value}`).join('; ');
}

export function cookiesForDomain(store: CookieStore, domain: string): StoredCookie[] {
  const normalized = normalizeDomain(domain);
  return store.cookies.filter((c) => normalizeDomain(c.domain) === normalized);
}

export function domainCookieCount(store: CookieStore, domain: string): number {
  return cookiesForDomain(store, domain).length;
}

export function sortedDomains(store: CookieStore): string[] {
  const set = new Set(store.domains.map(normalizeDomain));
  for (const cookie of store.cookies) {
    set.add(normalizeDomain(cookie.domain));
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function mergeResponseCookies(
  store: CookieStore,
  responseCookies: ResponseCookie[],
  requestUrl: string
): CookieStore {
  const host = extractHost(requestUrl);
  if (!host || responseCookies.length === 0) return store;

  if (!hostAllowedByAllowlist(host, store.domainAllowlist)) return store;

  let cookies = [...store.cookies];
  const domains = new Set(store.domains.map(normalizeDomain));

  for (const raw of responseCookies) {
    if (!raw.name) continue;
    const domain = normalizeDomain(raw.domain || host);
    const path = raw.path?.trim() || '/';

    if (!hostAllowedByAllowlist(domain, store.domainAllowlist)) continue;

    domains.add(domain);
    const idx = cookies.findIndex(
      (c) =>
        c.name === raw.name &&
        normalizeDomain(c.domain) === domain &&
        (c.path || '/') === path
    );

    const next: StoredCookie = {
      id: idx >= 0 ? cookies[idx].id : `cookie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: raw.name,
      value: raw.value,
      domain,
      path,
      enabled: true,
    };

    if (idx >= 0) {
      cookies[idx] = next;
    } else {
      cookies.push(next);
    }
  }

  return {
    ...store,
    domains: Array.from(domains).sort((a, b) => a.localeCompare(b)),
    cookies,
  };
}

export function addDomainToStore(store: CookieStore, domain: string): CookieStore {
  const normalized = normalizeDomain(domain);
  if (!normalized) return store;
  if (store.domains.some((d) => normalizeDomain(d) === normalized)) return store;
  return {
    ...store,
    domains: [...store.domains, normalized].sort((a, b) => a.localeCompare(b)),
  };
}

export function removeDomainFromStore(store: CookieStore, domain: string): CookieStore {
  const normalized = normalizeDomain(domain);
  return {
    ...store,
    domains: store.domains.filter((d) => normalizeDomain(d) !== normalized),
    cookies: store.cookies.filter((c) => normalizeDomain(c.domain) !== normalized),
  };
}

export function upsertCookieInStore(store: CookieStore, cookie: StoredCookie): CookieStore {
  const domain = normalizeDomain(cookie.domain);
  const domains = new Set(store.domains.map(normalizeDomain));
  domains.add(domain);

  const idx = store.cookies.findIndex((c) => c.id === cookie.id);
  const next = { ...cookie, domain };
  const cookies =
    idx >= 0
      ? store.cookies.map((c, i) => (i === idx ? next : c))
      : [...store.cookies, next];

  return {
    ...store,
    domains: Array.from(domains).sort((a, b) => a.localeCompare(b)),
    cookies,
  };
}

export function deleteCookieFromStore(store: CookieStore, cookieId: string): CookieStore {
  return {
    ...store,
    cookies: store.cookies.filter((c) => c.id !== cookieId),
  };
}

export function clearCookieStore(): CookieStore {
  return { domains: [], cookies: [], domainAllowlist: [] };
}
