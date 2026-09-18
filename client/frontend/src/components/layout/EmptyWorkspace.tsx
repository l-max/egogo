import { Plus } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './EmptyWorkspace.css';

export function EmptyWorkspace() {
  const { createRequest, t } = useApp();

  return (
    <div className="empty-workspace">
      <div className="empty-workspace-inner">
        <div className="empty-workspace-icon">
          <Plus size={28} />
        </div>
        <button className="empty-workspace-create" onClick={createRequest}>
          <Plus size={16} />
          {t.empty.createRequest}
        </button>
        <p className="empty-workspace-quote">«{t.empty.quote}»</p>
        <span className="empty-workspace-author">{t.empty.quoteAuthor}</span>
      </div>
    </div>
  );
}