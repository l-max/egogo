import { Plus, Trash2 } from 'lucide-react';
import type { KeyValueRow } from '../../types/request';
import { emptyRow } from '../../types/request';
import './KeyValueEditor.css';

interface KeyValueEditorProps {
  rows: KeyValueRow[];
  onChange: (rows: KeyValueRow[]) => void;
  keyPlaceholder?: string;
  valuePlaceholder?: string;
  addLabel?: string;
}

export function KeyValueEditor({
  rows,
  onChange,
  keyPlaceholder = 'Key',
  valuePlaceholder = 'Value',
  addLabel = 'Add',
}: KeyValueEditorProps) {
  function updateRow(index: number, patch: Partial<KeyValueRow>) {
    onChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function removeRow(index: number) {
    onChange(rows.length <= 1 ? [emptyRow()] : rows.filter((_, i) => i !== index));
  }

  function addRow() {
    onChange([...rows, emptyRow()]);
  }

  return (
    <div className="kv-editor">
      <div className="kv-editor-head">
        <span />
        <span>{keyPlaceholder}</span>
        <span>{valuePlaceholder}</span>
        <span />
      </div>
      {rows.map((row, index) => (
        <div key={index} className="kv-editor-row">
          <input
            type="checkbox"
            checked={row.enabled}
            onChange={(e) => updateRow(index, { enabled: e.target.checked })}
          />
          <input
            type="text"
            className="kv-cell-input kv-key-input selectable"
            value={row.key}
            placeholder={keyPlaceholder}
            onChange={(e) => updateRow(index, { key: e.target.value })}
          />
          <input
            type="text"
            className="kv-cell-input kv-value-input selectable"
            value={row.value}
            placeholder={valuePlaceholder}
            onChange={(e) => updateRow(index, { value: e.target.value })}
          />
          <button className="kv-remove" onClick={() => removeRow(index)}>
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button className="kv-add" onClick={addRow}>
        <Plus size={14} />
        {addLabel}
      </button>
    </div>
  );
}
