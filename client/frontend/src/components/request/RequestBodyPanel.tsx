import { useRef } from 'react';
import { ChevronDown } from 'lucide-react';
import type { RequestBodyMode, RequestBodyState, RequestRawLanguage } from '../../types/request';
import { ensureRows } from '../../types/request';
import { beautifyRawBody } from '../../utils/requestBody';
import { KeyValueEditor } from './KeyValueEditor';
import './RequestBodyPanel.css';

const BODY_MODES: RequestBodyMode[] = [
  'none',
  'form-data',
  'urlencoded',
  'raw',
  'binary',
  'graphql',
];

const RAW_LANGUAGES: { id: RequestRawLanguage; label: string }[] = [
  { id: 'text', label: 'Text' },
  { id: 'json', label: 'JSON' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'html', label: 'HTML' },
  { id: 'xml', label: 'XML' },
];

export interface RequestBodyPanelLabels {
  modes: Record<RequestBodyMode, string>;
  noneHint: string;
  beautify: string;
  jsonPlaceholder: string;
  xmlPlaceholder: string;
  graphqlQuery: string;
  graphqlVariables: string;
  selectFile: string;
  noFileSelected: string;
  paramKey: string;
  paramValue: string;
  addParam: string;
}

interface RequestBodyPanelProps {
  bodyState: RequestBodyState;
  labels: RequestBodyPanelLabels;
  onChange: (bodyState: RequestBodyState) => void;
}

export function RequestBodyPanel({ bodyState, labels, onChange }: RequestBodyPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  function patch(next: Partial<RequestBodyState>) {
    onChange({ ...bodyState, ...next });
  }

  function handleModeChange(mode: RequestBodyMode) {
    patch({ mode });
  }

  function handleBeautify() {
    patch({ raw: beautifyRawBody(bodyState.raw, bodyState.rawLanguage) });
  }

  async function handleFileSelect(file: File | null) {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    patch({
      binaryFileName: file.name,
      binaryBase64: btoa(binary),
    });
  }

  return (
    <div className="request-body-panel">
      <div className="body-mode-bar">
        <div className="body-mode-options">
          {BODY_MODES.map((mode) => (
            <label key={mode} className="body-mode-option">
              <input
                type="radio"
                name="body-mode"
                checked={bodyState.mode === mode}
                onChange={() => handleModeChange(mode)}
              />
              <span>{labels.modes[mode]}</span>
            </label>
          ))}
        </div>

        {bodyState.mode === 'raw' && (
          <div className="body-raw-toolbar">
            <label className="body-raw-language">
              <select
                value={bodyState.rawLanguage}
                onChange={(e) => patch({ rawLanguage: e.target.value as RequestRawLanguage })}
              >
                {RAW_LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={12} className="body-raw-language-icon" aria-hidden />
            </label>
            <button type="button" className="body-beautify-btn" onClick={handleBeautify}>
              {labels.beautify}
            </button>
          </div>
        )}
      </div>

      <div className="body-mode-content">
        {bodyState.mode === 'none' && (
          <div className="body-none-hint">{labels.noneHint}</div>
        )}

        {bodyState.mode === 'form-data' && (
          <KeyValueEditor
            rows={ensureRows(bodyState.formData)}
            onChange={(formData) => patch({ formData })}
            keyPlaceholder={labels.paramKey}
            valuePlaceholder={labels.paramValue}
            addLabel={labels.addParam}
          />
        )}

        {bodyState.mode === 'urlencoded' && (
          <KeyValueEditor
            rows={ensureRows(bodyState.urlencoded)}
            onChange={(urlencoded) => patch({ urlencoded })}
            keyPlaceholder={labels.paramKey}
            valuePlaceholder={labels.paramValue}
            addLabel={labels.addParam}
          />
        )}

        {bodyState.mode === 'raw' && (
          <textarea
            className="panel-body selectable"
            placeholder={
              bodyState.rawLanguage === 'json'
                ? labels.jsonPlaceholder
                : bodyState.rawLanguage === 'xml'
                  ? labels.xmlPlaceholder
                  : ''
            }
            value={bodyState.raw}
            onChange={(e) => patch({ raw: e.target.value })}
          />
        )}

        {bodyState.mode === 'binary' && (
          <div className="body-binary-panel">
            <input
              ref={fileInputRef}
              type="file"
              className="body-binary-input"
              onChange={(e) => void handleFileSelect(e.target.files?.[0] ?? null)}
            />
            <button
              type="button"
              className="body-binary-btn"
              onClick={() => fileInputRef.current?.click()}
            >
              {labels.selectFile}
            </button>
            <span className="body-binary-name">
              {bodyState.binaryFileName || labels.noFileSelected}
            </span>
          </div>
        )}

        {bodyState.mode === 'graphql' && (
          <div className="body-graphql-panel">
            <label className="body-graphql-block">
              <span>{labels.graphqlQuery}</span>
              <textarea
                className="panel-body selectable"
                placeholder="query { }"
                value={bodyState.graphqlQuery}
                onChange={(e) => patch({ graphqlQuery: e.target.value })}
              />
            </label>
            <label className="body-graphql-block">
              <span>{labels.graphqlVariables}</span>
              <textarea
                className="panel-body selectable"
                placeholder="{}"
                value={bodyState.graphqlVariables}
                onChange={(e) => patch({ graphqlVariables: e.target.value })}
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
