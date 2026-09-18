import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { EmptyWorkspace } from './EmptyWorkspace';
import { RequestPanel } from '../request/RequestPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { EnvironmentEditor } from '../environment/EnvironmentEditor';
import { useApp } from '../../context/AppContext';

export function AppLayout() {
  const { tabs, activeTabId } = useApp();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <TabBar />
        <div className="content-area">
          {activeTab ? (
            <>
              <RequestPanel />
              <SettingsPanel />
              <EnvironmentEditor />
            </>
          ) : (
            <EmptyWorkspace />
          )}
        </div>
      </div>
    </div>
  );
}
