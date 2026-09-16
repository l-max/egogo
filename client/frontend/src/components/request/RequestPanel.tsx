import { useState, useEffect, useMemo } from 'react';
import { Send, Save } from 'lucide-react';
import { useApp, methodColor } from '../../context/AppContext';
import type { HttpMethod } from '../../types';
import type { RequestSubTab, HttpResponseData } from '../../types/request';
import { ensureRows, defaultAuth } from '../../types/request';
import {
  resolveVariables,
  buildUrl,
  buildHeaders,
  headerRowsFromRecord,
  formatUrlWithParams,
  applyUrlEdit,
} from '../../utils/http';
import { applyBodyContentType, buildRequestBodyPayload } from '../../utils/requestBody';
import { resolveBodyState } from '../../types/request';
import type { RequestBodyState } from '../../types/request';
import { KeyValueEditor } from './KeyValueEditor';
import { RequestBodyPanel } from './RequestBodyPanel';
import { ResponseViewer } from './ResponseViewer';
import { CookiesModal } from './CookiesModal';
import { useSplitPanel } from '../../hooks/useSplitPanel';
import type { RequestAuth } from '../../types/request';
import { getCookiesForRequest, buildCookieHeader } from '../../utils/cookies';
import './RequestPanel.css';
import './KeyValueEditor.css';
import './ResponseViewer.css';
import './RequestBodyPanel.css';
import './CookiesModal.css';

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

const REQUEST_TABS: RequestSubTab[] = ['params', 'headers', 'body', 'authorization'];

export function RequestPanel() {
  const {
    tabs,
    activeTabId,
    environments,
    activeEnvironmentId,
    cookieStore,
    updateActiveTab,
    saveActiveTab,
    addCookieDomain,
    removeCookieDomain,
    upsertCookie,
    deleteCookie,
    clearAllCookies,
    updateCookieAllowlist,
    applyResponseCookies,
    t,
  } = useApp();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const [requestTab, setRequestTab] = useState<RequestSubTab>('params');
  const [response, setResponse] = useState<HttpResponseData | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [cookiesOpen, setCookiesOpen] = useState(false);
  const { panelRef, onDividerMouseDown } = useSplitPanel(50);

  const responseTabs = useMemo(
    () => [
      { id: 'body' as const, label: t.request.responseBody },
      { id: 'headers' as const, label: t.request.responseHeaders },
      { id: 'cookies' as const, label: t.request.cookies },
    ],
    [t.request.responseBody, t.request.responseHeaders, t.request.cookies]
  );

  const cookiesModalLabels = useMemo(
    () => ({
      title: t.cookies.title,
      manageCookies: t.cookies.manageCookies,
      syncCookies: t.cookies.syncCookies,
      syncComingSoon: t.cookies.syncComingSoon,
      domainPlaceholder: t.cookies.domainPlaceholder,
      addDomain: t.cookies.addDomain,
      cookiesCount: (n: number) =>
        n === 1 ? t.cookies.countOne : t.cookies.countMany.replace('{n}', String(n)),
      addCookie: t.cookies.addCookie,
      clearAll: t.cookies.clearAll,
      domainAllowlist: t.cookies.domainAllowlist,
      allowlistHint: t.cookies.allowlistHint,
      allowlistPlaceholder: t.cookies.allowlistPlaceholder,
      saveAllowlist: t.cookies.saveAllowlist,
      cookieName: t.cookies.cookieName,
      cookieValue: t.cookies.cookieValue,
      cookieDomain: t.cookies.cookieDomain,
      cookiePath: t.cookies.cookiePath,
      cookieEnabled: t.cookies.cookieEnabled,
      saveCookie: t.cookies.saveCookie,
      deleteCookie: t.cookies.deleteCookie,
      cancel: t.cookies.cancel,
      newCookie: t.cookies.newCookie,
    }),
    [t.cookies]
  );

  const bodyPanelLabels = useMemo(
    () => ({
      modes: {
        none: t.request.bodyModeNone,
        'form-data': t.request.bodyModeFormData,
        urlencoded: t.request.bodyModeUrlencoded,
        raw: t.request.bodyModeRaw,
        binary: t.request.bodyModeBinary,
        graphql: t.request.bodyModeGraphql,
      },
      noneHint: t.request.bodyNoneHint,
      beautify: t.request.bodyBeautify,
      jsonPlaceholder: t.request.bodyJsonPlaceholder,
      xmlPlaceholder: t.request.bodyXmlPlaceholder,
      graphqlQuery: t.request.graphqlQuery,
      graphqlVariables: t.request.graphqlVariables,
      selectFile: t.request.bodySelectFile,
      noFileSelected: t.request.bodyNoFile,
      paramKey: t.request.paramKey,
      paramValue: t.request.paramValue,
      addParam: t.request.addParam,
    }),
    [t.request]
  );

  useEffect(() => {
    setResponse(null);
    setRequestTab('params');
  }, [activeTabId]);

  if (!activeTab || activeTab.kind !== 'request') return null;

  const params = ensureRows(activeTab.params);
  const headerRows = ensureRows(
    activeTab.headerRows ??
      headerRowsFromRecord((activeTab as { headers?: Record<string, string> }).headers)
  );
  const auth = activeTab.auth ?? defaultAuth();
  const bodyState = resolveBodyState(activeTab);

  function getVariables(): Record<string, string> {
    const env = environments.find((e) => e.id === activeEnvironmentId);
    return env?.variables ?? {};
  }

  async function handleSend() {
    if (!activeTab) return;
    setLoading(true);
    setResponse(null);

    const vars = getVariables();
    const resolvedBase = resolveVariables(activeTab.url, vars);
    const resolvedParams = params.map((p) => ({
      ...p,
      key: p.key ? resolveVariables(p.key, vars) : p.key,
      value: resolveVariables(p.value, vars),
    }));
    const resolvedUrl = buildUrl(resolvedBase, resolvedParams);
    const headers = buildHeaders(
      headerRows.map((r) => ({
        ...r,
        key: resolveVariables(r.key, vars),
        value: resolveVariables(r.value, vars),
      })),
      {
        ...auth,
        token: auth.token ? resolveVariables(auth.token, vars) : undefined,
        username: auth.username ? resolveVariables(auth.username, vars) : undefined,
        password: auth.password ? resolveVariables(auth.password, vars) : undefined,
      }
    );

    const bodyPayload = buildRequestBodyPayload(bodyState, (value) => resolveVariables(value, vars));
    const requestHeaders = applyBodyContentType(headers, bodyPayload.contentType);

    const jarCookies = getCookiesForRequest(cookieStore, resolvedUrl);
    const jarHeader = buildCookieHeader(jarCookies);
    if (jarHeader) {
      const existing = requestHeaders.Cookie ?? requestHeaders.cookie;
      requestHeaders.Cookie = existing ? `${existing}; ${jarHeader}` : jarHeader;
      delete requestHeaders.cookie;
    }

    try {
      const { SendRequest } = await import('../../../wailsjs/go/main/App');
      const { main } = await import('../../../wailsjs/go/models');

      const result = await SendRequest(
        new main.HTTPRequest({
          method: activeTab.method,
          url: resolvedUrl,
          headers: requestHeaders,
          body: bodyPayload.body,
          bodyIsBase64: bodyPayload.bodyIsBase64,
        })
      );

      if (result.error) {
        setResponse({
          statusCode: 0,
          status: '',
          durationMs: result.durationMs,
          headers: {},
          cookies: [],
          body: '',
          error: result.error,
        });
        return;
      }

      const cookies = (result.cookies ?? []).map((c: { name: string; value: string; domain?: string; path?: string }) => ({
        name: c.name,
        value: c.value,
        domain: c.domain,
        path: c.path,
      }));

      setResponse({
        statusCode: result.statusCode,
        status: result.status,
        durationMs: result.durationMs,
        headers: result.headers ?? {},
        cookies,
        body: result.body ?? '',
      });

      if (cookies.length > 0) {
        applyResponseCookies(cookies, resolvedUrl);
      }
    } catch (err) {
      setResponse({
        statusCode: 0,
        status: '',
        durationMs: 0,
        headers: {},
        cookies: [],
        body: '',
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    const ok = await saveActiveTab();
    setSaving(false);
    if (ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
    }
  }

  function updateParams(rows: typeof params) {
    updateActiveTab({ params: rows });
  }

  function updateHeaders(rows: typeof headerRows) {
    updateActiveTab({ headerRows: rows });
  }

  function updateAuth(patch: Partial<RequestAuth>) {
    updateActiveTab({ auth: { ...auth, ...patch } });
  }

  function updateBodyState(next: RequestBodyState) {
    if (!activeTab) return;
    updateActiveTab({
      bodyState: next,
      body: next.mode === 'raw' ? next.raw : activeTab.body ?? '',
    });
  }

  const requestTabLabels: Record<RequestSubTab, string> = {
    params: t.request.params,
    headers: t.request.headers,
    body: t.request.body,
    authorization: t.request.authorization,
  };

  const activeParamsCount = params.filter((p) => p.enabled && p.key.trim()).length;
  const activeHeadersCount = headerRows.filter((h) => h.enabled && h.key.trim()).length;
  const displayUrl = formatUrlWithParams(activeTab.url, params);

  function handleUrlChange(rawUrl: string) {
    const { url, params: parsedParams } = applyUrlEdit(rawUrl);
    updateActiveTab({ url, params: parsedParams });
  }

  return (
    <div className="request-panel">
      <div className="request-toolbar">
        <select
          className="method-select"
          value={activeTab.method}
          onChange={(e) => updateActiveTab({ method: e.target.value as HttpMethod })}
          style={{ color: methodColor(activeTab.method) }}
        >
          {METHODS.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="url-input selectable"
          value={displayUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="https://"
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
        />
        <button
          className={`save-btn ${savedFlash ? 'saved' : ''} ${activeTab.dirty ? 'dirty' : ''}`}
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={14} />
          {savedFlash ? t.request.saved : t.request.save}
        </button>
        <button className="send-btn" onClick={handleSend} disabled={loading}>
          <Send size={14} />
          {t.request.send}
        </button>
      </div>

      <div ref={panelRef} className="split-panel">
        <div className="panel-section request-panel-section">
          <div className="sub-tabs-bar">
            <div className="sub-tabs">
              {REQUEST_TABS.map((tab) => (
                <button
                  key={tab}
                  className={`sub-tab ${requestTab === tab ? 'active' : ''}`}
                  onClick={() => setRequestTab(tab)}
                >
                  {requestTabLabels[tab]}
                  {tab === 'params' && activeParamsCount > 0 && (
                    <span className="sub-tab-badge">{activeParamsCount}</span>
                  )}
                  {tab === 'headers' && activeHeadersCount > 0 && (
                    <span className="sub-tab-badge">{activeHeadersCount}</span>
                  )}
                </button>
              ))}
            </div>
            <button className="cookies-link-btn" onClick={() => setCookiesOpen(true)}>
              {t.request.cookies}
            </button>
          </div>
          <div className="sub-tab-content">
            {requestTab === 'params' && (
              <KeyValueEditor
                rows={params}
                onChange={updateParams}
                keyPlaceholder={t.request.paramKey}
                valuePlaceholder={t.request.paramValue}
                addLabel={t.request.addParam}
              />
            )}
            {requestTab === 'headers' && (
              <KeyValueEditor
                rows={headerRows}
                onChange={updateHeaders}
                keyPlaceholder={t.request.headerKey}
                valuePlaceholder={t.request.headerValue}
                addLabel={t.request.addHeader}
              />
            )}
            {requestTab === 'body' && (
              <RequestBodyPanel
                bodyState={bodyState}
                labels={bodyPanelLabels}
                onChange={updateBodyState}
              />
            )}
            {requestTab === 'authorization' && (
              <div className="auth-form">
                <div className="auth-type-row">
                  <span>{t.request.authType}</span>
                  <select
                    value={auth.type}
                    onChange={(e) =>
                      updateAuth({ type: e.target.value as RequestAuth['type'] })
                    }
                  >
                    <option value="none">{t.request.authNone}</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                  </select>
                </div>
                {auth.type === 'bearer' && (
                  <label>
                    Token
                    <input
                      className="selectable"
                      value={auth.token ?? ''}
                      onChange={(e) => updateAuth({ token: e.target.value })}
                      placeholder="your-token"
                    />
                  </label>
                )}
                {auth.type === 'basic' && (
                  <>
                    <label>
                      Username
                      <input
                        className="selectable"
                        value={auth.username ?? ''}
                        onChange={(e) => updateAuth({ username: e.target.value })}
                      />
                    </label>
                    <label>
                      Password
                      <input
                        className="selectable"
                        type="password"
                        value={auth.password ?? ''}
                        onChange={(e) => updateAuth({ password: e.target.value })}
                      />
                    </label>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="split-divider" onMouseDown={onDividerMouseDown} />

        <div className="panel-section response-panel-section">
          <ResponseViewer
            data={response}
            loading={loading}
            noResponseText={t.request.noResponse}
            prettyLabel={t.request.pretty}
            bodyPanelLabels={{
              copy: t.request.copy,
              copied: t.request.copied,
              search: t.request.search,
              searchPlaceholder: t.request.searchPlaceholder,
              noResults: t.request.noResults,
            }}
            copyLabels={{
              copy: t.request.copy,
              copied: t.request.copied,
            }}
            tabs={responseTabs}
          />
        </div>
      </div>

      <CookiesModal
        open={cookiesOpen}
        store={cookieStore}
        labels={cookiesModalLabels}
        onClose={() => setCookiesOpen(false)}
        onAddDomain={addCookieDomain}
        onRemoveDomain={removeCookieDomain}
        onUpsertCookie={upsertCookie}
        onDeleteCookie={deleteCookie}
        onClearAll={clearAllCookies}
        onUpdateAllowlist={updateCookieAllowlist}
      />
    </div>
  );
}
