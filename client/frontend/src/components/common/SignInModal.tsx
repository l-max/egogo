import { useEffect, useState } from 'react';
import { LogIn, Link2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './SignInModal.css';

type SignInTab = 'login' | 'invite';

interface SignInModalProps {
  onClose: () => void;
  initialTab?: SignInTab;
  initialInviteUrl?: string;
}

export function SignInModal({ onClose, initialTab = 'login', initialInviteUrl = '' }: SignInModalProps) {
  const { t, signIn, redeemInvite, checkPendingInvite } = useApp();
  const [tab, setTab] = useState<SignInTab>(initialTab);
  const [serverUrl, setServerUrl] = useState('http://localhost:8090');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteUrl, setInviteUrl] = useState(initialInviteUrl);
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialInviteUrl) {
      setTab('invite');
      setInviteUrl(initialInviteUrl);
    }
  }, [initialInviteUrl]);

  useEffect(() => {
    (async () => {
      const pending = await checkPendingInvite();
      if (pending) {
        setTab('invite');
        setInviteUrl(pending.inviteUrl);
        setServerUrl(pending.serverUrl);
        setInviteEmail(pending.email);
      }
    })();
  }, [checkPendingInvite]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await signIn(serverUrl, email, password);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.profile.signInError);
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (invitePassword.length < 8) {
      setError(t.profile.invitePasswordHint);
      return;
    }
    setLoading(true);
    try {
      await redeemInvite(inviteUrl, invitePassword);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : t.profile.signInError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="signin-modal-overlay" onMouseDown={onClose}>
      <div className="signin-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="signin-modal-header">
          <h2>{t.profile.signInTitle}</h2>
        </div>

        <div className="signin-modal-tabs">
          <button
            type="button"
            className={`signin-modal-tab ${tab === 'login' ? 'active' : ''}`}
            onClick={() => { setTab('login'); setError(''); }}
          >
            <LogIn size={14} />
            {t.profile.signInLogin}
          </button>
          <button
            type="button"
            className={`signin-modal-tab ${tab === 'invite' ? 'active' : ''}`}
            onClick={() => { setTab('invite'); setError(''); }}
          >
            <Link2 size={14} />
            {t.profile.signInInvite}
          </button>
        </div>

        {tab === 'login' ? (
          <form className="signin-modal-body" onSubmit={handleLogin}>
            <label className="signin-field">
              <span>{t.profile.serverUrl}</span>
              <input
                type="url"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:8090"
                required
              />
            </label>
            <label className="signin-field">
              <span>{t.profile.email}</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                required
              />
            </label>
            <label className="signin-field">
              <span>{t.profile.password}</span>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            {error && <div className="signin-error">{error}</div>}
            <div className="signin-modal-footer">
              <button type="button" className="signin-btn secondary" onClick={onClose}>
                {t.profile.cancel}
              </button>
              <button type="submit" className="signin-btn primary" disabled={loading}>
                {loading ? t.profile.signingIn : t.profile.submit}
              </button>
            </div>
          </form>
        ) : (
          <form className="signin-modal-body" onSubmit={handleInvite}>
            {inviteEmail && (
              <div className="signin-invite-welcome">
                {t.profile.inviteWelcome.replace('{email}', inviteEmail)}
              </div>
            )}
            <label className="signin-field">
              <span>{t.profile.inviteUrl}</span>
              <input
                type="text"
                value={inviteUrl}
                onChange={(e) => setInviteUrl(e.target.value)}
                placeholder="egogo://auth/invite?token=...&server=..."
                required
              />
            </label>
            <label className="signin-field">
              <span>{t.profile.setPassword}</span>
              <input
                type="password"
                value={invitePassword}
                onChange={(e) => setInvitePassword(e.target.value)}
                autoComplete="new-password"
                minLength={8}
                required
              />
              <span className="signin-hint">{t.profile.invitePasswordHint}</span>
            </label>
            {error && <div className="signin-error">{error}</div>}
            <div className="signin-modal-footer">
              <button type="button" className="signin-btn secondary" onClick={onClose}>
                {t.profile.cancel}
              </button>
              <button type="submit" className="signin-btn primary" disabled={loading}>
                {loading ? t.profile.signingIn : t.profile.activateAccount}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
