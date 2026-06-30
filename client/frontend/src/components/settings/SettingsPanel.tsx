import { useApp } from '../../context/AppContext';
import './SettingsPanel.css';

export function SettingsPanel() {
  const { tabs, activeTabId, settings, setLanguage, setMyProfileName, t } = useApp();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  if (!activeTab || activeTab.kind !== 'settings') return null;

  return (
    <div className="settings-panel">
      <h1 className="settings-title">{t.settings.title}</h1>

      <section className="settings-section">
        <h2>{t.settings.language}</h2>
        <div className="settings-row">
          <label>
            <input
              type="radio"
              name="language"
              checked={settings.language === 'ru'}
              onChange={() => setLanguage('ru')}
            />
            {t.settings.languageRu}
          </label>
          <label>
            <input
              type="radio"
              name="language"
              checked={settings.language === 'en'}
              onChange={() => setLanguage('en')}
            />
            {t.settings.languageEn}
          </label>
        </div>
      </section>

      <section className="settings-section">
        <h2>{t.settings.myProfileName}</h2>
        <input
          className="settings-input"
          value={settings.myProfileName}
          onChange={(e) => setMyProfileName(e.target.value)}
        />
      </section>
    </div>
  );
}
