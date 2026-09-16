import { useState, useEffect } from 'react';
import { X, Plus } from 'lucide-react';
import type { CookieStore, StoredCookie } from '../../types/cookies';
import {
  sortedDomains,
  cookiesForDomain,
  domainCookieCount,
  normalizeDomain,
} from '../../utils/cookies';
import './CookiesModal.css';

export interface CookiesModalLabels {
  title: string;
  manageCookies: string;
  syncCookies: string;
  syncComingSoon: string;
  domainPlaceholder: string;
  addDomain: string;
  cookiesCount: (n: number) => string;
  addCookie: string;
  clearAll: string;
  domainAllowlist: string;
  allowlistHint: string;
  allowlistPlaceholder: string;
  saveAllowlist: string;
  cookieName: string;
  cookieValue: string;
  cookieDomain: string;
  cookiePath: string;
  cookieEnabled: string;
  saveCookie: string;
  deleteCookie: string;
  cancel: string;
  newCookie: string;
}

interface CookiesModalProps {
  open: boolean;
  store: CookieStore;
  labels: CookiesModalLabels;
  onClose: () => void;
  onAddDomain: (domain: string) => void;
  onRemoveDomain: (domain: string) => void;
  onUpsertCookie: (cookie: StoredCookie) => void;
  onDeleteCookie: (cookieId: string) => void;
  onClearAll: () => void;
  onUpdateAllowlist: (allowlist: string[]) => void;
}

type ModalTab = 'manage' | 'sync';

function newCookieId() {
  return `cookie-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function CookiesModal({
  open,
  store,
  labels,
  onClose,
  onAddDomain,
  onRemoveDomain,
  onUpsertCookie,
  onDeleteCookie,
  onClearAll,
  onUpdateAllowlist,
}: CookiesModalProps) {
  const [tab, setTab] = useState<ModalTab>('manage');
  const [domainInput, setDomainInput] = useState('');
  const [editing, setEditing] = useState<StoredCookie | null>(null);
  const [showAllowlist, setShowAllowlist] = useState(false);
  const [allowlistDraft, setAllowlistDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    setTab('manage');
    setDomainInput('');
    setEditing(null);
    setShowAllowlist(false);
    setAllowlistDraft(store.domainAllowlist.join('\n'));
  }, [open, store.domainAllowlist]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const domains = sortedDomains(store);

  function handleAddDomain() {
    const domain = normalizeDomain(domainInput);
    if (!domain) return;
    onAddDomain(domain);
    setDomainInput('');
  }

  function startAddCookie(domain: string) {
    setEditing({
      id: newCookieId(),
      name: '',
      value: '',
      domain: normalizeDomain(domain),
      path: '/',
      enabled: true,
    });
  }

  function startEditCookie(cookie: StoredCookie) {
    setEditing({ ...cookie });
  }

  function saveEditing() {
    if (!editing || !editing.name.trim() || !editing.domain.trim()) return;
    onUpsertCookie(editing);
    setEditing(null);
  }

  function deleteEditing() {
    if (!editing) return;
    if (store.cookies.some((c) => c.id === editing.id)) {
      onDeleteCookie(editing.id);
    }
    setEditing(null);
  }

  return (
    <div className="cookies-modal-overlay" onMouseDown={onClose}>
      <div className="cookies-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="cookies-modal-header">
          <h2>{labels.title}</h2>
          <button className="cookies-modal-close" onClick={onClose} aria-label={labels.cancel}>
            <X size={18} />
          </button>
        </div>

        <div className="cookies-modal-tabs">
          <button
            className={`cookies-modal-tab ${tab === 'manage' ? 'active' : ''}`}
            onClick={() => setTab('manage')}
          >
            {labels.manageCookies}
          </button>
          <button
            className={`cookies-modal-tab ${tab === 'sync' ? 'active' : ''}`}
            onClick={() => setTab('sync')}
          >
            {labels.syncCookies}
          </button>
        </div>

        <div className="cookies-modal-body">
          {tab === 'sync' ? (
            <div className="cookies-sync-placeholder">{labels.syncComingSoon}</div>
          ) : showAllowlist ? (
            <div className="cookies-allowlist-panel">
              <p className="cookies-allowlist-hint">{labels.allowlistHint}</p>
              <textarea
                className="cookies-allowlist-input selectable"
                value={allowlistDraft}
                placeholder={labels.allowlistPlaceholder}
                onChange={(e) => setAllowlistDraft(e.target.value)}
              />
              <div className="cookies-allowlist-actions">
                <button
                  className="cookies-btn"
                  onClick={() => {
                    setShowAllowlist(false);
                    setAllowlistDraft(store.domainAllowlist.join('\n'));
                  }}
                >
                  {labels.cancel}
                </button>
                <button
                  className="cookies-btn primary"
                  onClick={() => {
                    const list = allowlistDraft
                      .split('\n')
                      .map((line) => normalizeDomain(line))
                      .filter(Boolean);
                    onUpdateAllowlist(list);
                    setShowAllowlist(false);
                  }}
                >
                  {labels.saveAllowlist}
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="cookies-domain-row">
                <input
                  type="text"
                  className="cookies-domain-input selectable"
                  value={domainInput}
                  placeholder={labels.domainPlaceholder}
                  onChange={(e) => setDomainInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddDomain()}
                />
                <button className="cookies-btn" onClick={handleAddDomain}>
                  {labels.addDomain}
                </button>
              </div>

              <div className="cookies-domain-list">
                {domains.length === 0 && (
                  <div className="cookies-empty">—</div>
                )}
                {domains.map((domain) => {
                  const domainCookies = cookiesForDomain(store, domain);
                  const count = domainCookieCount(store, domain);
                  return (
                    <div key={domain} className="cookies-domain-block">
                      <div className="cookies-domain-head">
                        <div className="cookies-domain-title">
                          <span className="cookies-domain-name">{domain}</span>
                          <span className="cookies-domain-meta">{labels.cookiesCount(count)}</span>
                        </div>
                        <button
                          className="cookies-domain-remove"
                          onClick={() => onRemoveDomain(domain)}
                          aria-label={labels.deleteCookie}
                        >
                          <X size={14} />
                        </button>
                      </div>
                      <div className="cookies-chips">
                        {domainCookies.map((cookie) => (
                          <button
                            key={cookie.id}
                            className={`cookie-chip ${cookie.enabled ? '' : 'disabled'}`}
                            onClick={() => startEditCookie(cookie)}
                            title={cookie.value}
                          >
                            {cookie.name}
                          </button>
                        ))}
                        <button className="cookie-chip add" onClick={() => startAddCookie(domain)}>
                          <Plus size={12} />
                          {labels.addCookie}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {editing && (
                <div className="cookies-editor">
                  <div className="cookies-editor-title">
                    {store.cookies.some((c) => c.id === editing.id)
                      ? editing.name || labels.cookieName
                      : labels.newCookie}
                  </div>
                  <label>
                    {labels.cookieName}
                    <input
                      type="text"
                      className="selectable"
                      value={editing.name}
                      onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    />
                  </label>
                  <label>
                    {labels.cookieValue}
                    <input
                      type="text"
                      className="selectable"
                      value={editing.value}
                      onChange={(e) => setEditing({ ...editing, value: e.target.value })}
                    />
                  </label>
                  <label>
                    {labels.cookieDomain}
                    <input
                      type="text"
                      className="selectable"
                      value={editing.domain}
                      onChange={(e) => setEditing({ ...editing, domain: e.target.value })}
                    />
                  </label>
                  <label>
                    {labels.cookiePath}
                    <input
                      type="text"
                      className="selectable"
                      value={editing.path}
                      onChange={(e) => setEditing({ ...editing, path: e.target.value })}
                    />
                  </label>
                  <label className="cookies-enabled-row">
                    <input
                      type="checkbox"
                      checked={editing.enabled}
                      onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}
                    />
                    {labels.cookieEnabled}
                  </label>
                  <div className="cookies-editor-actions">
                    <button className="cookies-btn danger" onClick={deleteEditing}>
                      {labels.deleteCookie}
                    </button>
                    <button className="cookies-btn" onClick={() => setEditing(null)}>
                      {labels.cancel}
                    </button>
                    <button className="cookies-btn primary" onClick={saveEditing}>
                      {labels.saveCookie}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {tab === 'manage' && !showAllowlist && (
          <div className="cookies-modal-footer">
            <button className="cookies-btn" onClick={() => setShowAllowlist(true)}>
              {labels.domainAllowlist}
            </button>
            <button className="cookies-btn link danger" onClick={onClearAll}>
              {labels.clearAll}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
