import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { RequestPanel } from '../request/RequestPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { EnvironmentEditor } from '../environment/EnvironmentEditor';

export function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <TabBar />
        <div className="content-area">
          <RequestPanel />
          <SettingsPanel />
          <EnvironmentEditor />
        </div>
      </div>
    </div>
  );
}
