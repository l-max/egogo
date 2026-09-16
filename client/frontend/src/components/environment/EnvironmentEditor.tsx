import { useState, useEffect } from 'react';
import { Save, Plus, Trash2 } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import './EnvironmentEditor.css';

export function EnvironmentEditor() {
  const { tabs, activeTabId, environments, saveEnvironment, t } = useApp();
  const activeTab = tabs.find((tab) => tab.id === activeTabId);

  const envId = activeTab?.kind === 'environment' ? activeTab.environmentId : null;
  const env = environments.find((e) => e.id === envId);

  const [rows, setRows] = useState<{ key: string; value: string }[]>([]);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!envId || !env) return;
    const entries = Object.entries(env.variables);
    setRows(entries.length > 0 ? entries.map(([key, value]) => ({ key, value })) : [{ key: '', value: '' }]);
  }, [envId]);

  if (!activeTab || activeTab.kind !== 'environment' || !env) return null;

  function updateRow(index: number, field: 'key' | 'value', val: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: val } : r)));
  }

  function addRow() {
    setRows((prev) => [...prev, { key: '', value: '' }]);
  }

  function removeRow(index: number) {
    setRows((prev) => (prev.length <= 1 ? [{ key: '', value: '' }] : prev.filter((_, i) => i !== index)));
  }

  async function handleSave() {
    const variables: Record<string, string> = {};
    for (const row of rows) {
      const key = row.key.trim();
      if (key) variables[key] = row.value;
    }
    await saveEnvironment(env!.id, variables);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  return (
    <div className="env-editor">
      <div className="env-editor-header">
        <h1>{env.name}</h1>
        <button className={`env-editor-save ${savedFlash ? 'saved' : ''}`} onClick={handleSave}>
          <Save size={14} />
          {savedFlash ? t.environment.saved : t.environment.save}
        </button>
      </div>

      <div className="env-editor-table">
        <div className="env-editor-table-head">
          <span>{t.environment.variable}</span>
          <span>{t.environment.value}</span>
          <span />
        </div>
        {rows.map((row, index) => (
          <div key={index} className="env-editor-row">
            <input
              className="selectable"
              value={row.key}
              placeholder="baseUrl"
              onChange={(e) => updateRow(index, 'key', e.target.value)}
            />
            <input
              className="selectable"
              value={row.value}
              placeholder="http://localhost:8080"
              onChange={(e) => updateRow(index, 'value', e.target.value)}
            />
            <button className="env-editor-remove" onClick={() => removeRow(index)}>
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button className="env-editor-add" onClick={addRow}>
        <Plus size={14} />
        {t.environment.addVariable}
      </button>
    </div>
  );
}
