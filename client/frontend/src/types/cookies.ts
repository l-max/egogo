export interface StoredCookie {
  id: string;
  name: string;
  value: string;
  domain: string;
  path: string;
  enabled: boolean;
}

export interface CookieStore {
  domains: string[];
  cookies: StoredCookie[];
  domainAllowlist: string[];
}

export function emptyCookieStore(): CookieStore {
  return { domains: [], cookies: [], domainAllowlist: [] };
}
