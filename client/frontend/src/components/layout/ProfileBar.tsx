import { Settings } from 'lucide-react';
import { ProfileDropdown } from '../common/ProfileDropdown';
import { useApp } from '../../context/AppContext';

export function ProfileBar() {
  const { openSettings } = useApp();

  return (
    <div className="profile-bar">
      <ProfileDropdown />
      <button className="profile-bar-settings" onClick={openSettings} title="Settings">
        <Settings size={16} />
      </button>
    </div>
  );
}
