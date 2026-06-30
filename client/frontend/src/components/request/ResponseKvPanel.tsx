import { useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { ContextMenu } from '../common/ContextMenu';
import { copyTextToClipboard } from '../../utils/clipboard';
import { useSelectableCopy } from '../../hooks/useSelectableCopy';
import './ResponseKvPanel.css';

export interface ResponseKvRow {
  key: string;
  value: string;
}

interface ResponseKvPanelLabels {
  copy: string;
  copied: string;
}

interface ResponseKvPanelProps {
  rows: ResponseKvRow[];
  labels: ResponseKvPanelLabels;
}

function formatRowsText(rows: ResponseKvRow[]): string {
  return rows.map((row) => `${row.key}: ${row.value}`).join('\n');
}

export function ResponseKvPanel({ rows, labels }: ResponseKvPanelProps) {
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const { contextMenu, setContextMenu, copySelection, onContextMenu } =
    useSelectableCopy(contentRef);

  async function handleCopyAll() {
    if (rows.length === 0) return;
    await copyTextToClipboard(formatRowsText(rows));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="response-kv-panel">
      <div className="response-kv-toolbar">
        <button
          className="response-kv-action"
          onClick={handleCopyAll}
          disabled={rows.length === 0}
          title={labels.copy}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? labels.copied : labels.copy}</span>
        </button>
      </div>

      <div
        ref={contentRef}
        className="response-kv-content selectable"
        onContextMenu={onContextMenu}
      >
        {rows.length === 0 ? (
          <div className="response-placeholder">—</div>
        ) : (
          <div className="kv-readonly">
            {rows.map((row, i) => (
              <div key={`${row.key}-${i}`} className="kv-readonly-row">
                <span className="kv-readonly-key">{row.key}</span>
                <span className="kv-readonly-val">{row.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[{ action: 'copy', label: labels.copy }]}
          onSelect={(action) => {
            if (action === 'copy') void copySelection();
          }}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
