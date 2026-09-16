import { useState, useRef, useEffect } from 'react';
import { ChevronDown, LogOut, Settings, UserPlus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { Avatar } from './Avatar';
import { SignInModal } from './SignInModal';
import './ProfileDropdown.css';

export function ProfileDropdown() {
  const { activeProfile, profiles, switchProfile, signOut, t } = useApp();
  const [open, setOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const { EventsOn } = await import('../../../wailsjs/runtime/runtime');
        EventsOn('auth:invite', (url: string) => {
          setInviteUrl(url);
          setSignInOpen(true);
        });
      } catch {
        // outside wails
      }
    })();
  }, []);

  return (
    <>
      <div className="profile-dropdown-wrap" ref={ref}>
        <div className="profile-selector" onClick={() => setOpen(!open)}>
          <Avatar letter={activeProfile.avatarLetter} color={activeProfile.avatarColor} />
          <div className="profile-info">
            <div className="profile-name">{activeProfile.name}</div>
            <div className="profile-server">
              {activeProfile.serverName ?? t.profile.local}
            </div>
          </div>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </div>

        {open && (
          <div className="profile-dropdown">
            {profiles.map((profile) => (
              <div
                key={profile.id}
                className={`profile-dropdown-item ${profile.id === activeProfile.id ? 'active' : ''}`}
              >
                <div
                  className="profile-dropdown-main"
                  onClick={() => {
                    switchProfile(profile.id);
                    setOpen(false);
                  }}
                >
                  <Avatar letter={profile.avatarLetter} color={profile.avatarColor} size={24} />
                  <div className="profile-info">
                    <div className="profile-name">{profile.name}</div>
                    <div className="profile-server">
                      {profile.serverName ?? t.profile.local}
                    </div>
                  </div>
                </div>
                <div className="profile-dropdown-actions">
                  <button title={t.profile.settings} className="icon-btn">
                    <Settings size={14} />
                  </button>
                  {profile.type !== 'local' && (
                    <button
                      title={t.profile.signOut}
                      className="icon-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        signOut(profile.id);
                        setOpen(false);
                      }}
                    >
                      <LogOut size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
            <div className="profile-dropdown-divider" />
            <button
              className="profile-dropdown-signin"
              onClick={() => {
                setInviteUrl('');
                setSignInOpen(true);
                setOpen(false);
              }}
            >
              <UserPlus size={14} />
              {t.profile.signIn}
            </button>
          </div>
        )}
      </div>

      {signInOpen && (
        <SignInModal
          onClose={() => setSignInOpen(false)}
          initialInviteUrl={inviteUrl}
          initialTab={inviteUrl ? 'invite' : 'login'}
        />
      )}
    </>
  );
}
