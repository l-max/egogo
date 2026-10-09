import { Sidebar } from './Sidebar';
import { TabBar } from './TabBar';
import { EmptyWorkspace } from './EmptyWorkspace';
import { RequestPanel } from '../request/RequestPanel';
import { SettingsPanel } from '../settings/SettingsPanel';
import { EnvironmentEditor } from '../environment/EnvironmentEditor';
import { ConnectionAlertModal } from '../common/ConnectionAlertModal';
import { SignInModal } from '../common/SignInModal';
import { useApp } from '../../context/AppContext';

export function AppLayout() {
  const { tabs, activeTabId, signInModalOpen, signInInviteUrl, closeSignIn } = useApp();
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
      <ConnectionAlertModal />
      {signInModalOpen && (
        <SignInModal
          onClose={closeSignIn}
          initialInviteUrl={signInInviteUrl}
          initialTab={signInInviteUrl ? 'invite' : 'login'}
        />
      )}
    </div>
  );
}
