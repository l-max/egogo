import { WifiOff, AlertTriangle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './ConnectionAlertModal.css';

export function ConnectionAlertModal() {
  const { t, connectionAlert, closeConnectionAlert, switchToLocalFromAlert } = useApp();

  if (!connectionAlert) return null;

  if (connectionAlert.kind === 'unavailable') {
    return (
      <div className="conn-alert-overlay">
        <div className="conn-alert-modal">
          <div className="conn-alert-icon error">
            <AlertTriangle size={20} />
          </div>
          <h2>{t.profile.serverUnreachable}</h2>
          <p>
            {t.profile.serverUnavailableHint.replace('{server}', connectionAlert.profileName)}
          </p>
          <div className="conn-alert-footer">
            <button type="button" className="conn-alert-btn primary" onClick={closeConnectionAlert}>
              {t.profile.ok}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="conn-alert-overlay">
      <div className="conn-alert-modal">
        <div className="conn-alert-icon error">
          <WifiOff size={20} />
        </div>
        <h2>{t.profile.connectionLostTitle}</h2>
        <p>
          {t.profile.connectionLostMessage.replace('{server}', connectionAlert.profileName)}
        </p>
        <div className="conn-alert-footer">
          <button type="button" className="conn-alert-btn secondary" onClick={closeConnectionAlert}>
            {t.profile.stay}
          </button>
          <button
            type="button"
            className="conn-alert-btn primary"
            onClick={switchToLocalFromAlert}
          >
            {t.profile.switchToAnotherAccount}
          </button>
        </div>
      </div>
    </div>
  );
}