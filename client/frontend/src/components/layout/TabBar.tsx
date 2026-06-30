import { X, Globe } from 'lucide-react';
import { useApp, methodColor } from '../../context/AppContext';
import { EnvironmentSelector } from '../common/EnvironmentSelector';

export function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useApp();

  return (
    <div className="tab-bar">
      <div className="tab-bar-tabs">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`tab ${tab.id === activeTabId ? 'active' : ''} ${tab.dirty ? 'dirty' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.kind === 'request' && (
              <span className="tab-request-label">
                <span className="tab-method" style={{ color: methodColor(tab.method) }}>
                  {tab.method}
                </span>
                <span className="tab-title">{tab.name}</span>
              </span>
            )}
            {tab.kind === 'environment' && (
              <>
                <Globe size={12} style={{ color: 'var(--text-muted)' }} />
                <span className="tab-title">{tab.name}</span>
              </>
            )}
            {tab.kind === 'settings' && <span className="tab-title">{tab.name}</span>}
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.id);
              }}
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
      <div className="tab-bar-env">
        <EnvironmentSelector />
      </div>
    </div>
  );
}
