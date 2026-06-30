import { useState, useEffect, memo } from 'react';
import { ChevronDown } from 'lucide-react';
import type { BodyFormat, HttpResponseData, ResponseSubTab } from '../../types/request';
import { responseSummary, statusColor, detectBodyFormat, formatHttpStatus } from '../../utils/http';
import { ResponseBodyPanel } from './ResponseBodyPanel';
import { ResponseKvPanel } from './ResponseKvPanel';
import './ResponseViewer.css';

const FORMATS: { id: BodyFormat; label: string }[] = [
  { id: 'json', label: 'JSON' },
  { id: 'xml', label: 'XML' },
  { id: 'html', label: 'HTML' },
  { id: 'yaml', label: 'YAML' },
  { id: 'javascript', label: 'JavaScript' },
  { id: 'markdown', label: 'Markdown' },
  { id: 'preview', label: 'Preview' },
];

interface ResponseCopyLabels {
  copy: string;
  copied: string;
}

interface ResponseBodyPanelLabels extends ResponseCopyLabels {
  search: string;
  searchPlaceholder: string;
  noResults: string;
}

interface ResponseViewerProps {
  data: HttpResponseData | null;
  loading: boolean;
  noResponseText: string;
  prettyLabel: string;
  bodyPanelLabels: ResponseBodyPanelLabels;
  copyLabels: ResponseCopyLabels;
  tabs: { id: ResponseSubTab; label: string }[];
}

export const ResponseViewer = memo(function ResponseViewer({
  data,
  loading,
  noResponseText,
  prettyLabel,
  bodyPanelLabels,
  copyLabels,
  tabs,
}: ResponseViewerProps) {
  const [activeTab, setActiveTab] = useState<ResponseSubTab>('body');
  const [format, setFormat] = useState<BodyFormat>('json');
  const [formatOpen, setFormatOpen] = useState(false);
  const [pretty, setPretty] = useState(true);

  useEffect(() => {
    if (data?.body && !data.error) {
      const ct = data.headers['Content-Type'] ?? data.headers['content-type'];
      setFormat(detectBodyFormat(ct, data.body));
    }
  }, [data?.body, data?.headers, data?.error]);

  const headerCount = data ? Object.keys(data.headers).length : 0;
  const cookieCount = data?.cookies.length ?? 0;
  const usePanelLayout = Boolean(data && !loading);

  return (
    <div className="response-viewer">
      {data && !data.error && (
        <div className="response-status-bar">
          <span className="response-status-code" style={{ color: statusColor(data.statusCode) }}>
            {formatHttpStatus(data.statusCode, data.status)}
          </span>
          <span className="response-status-meta">{data.durationMs} ms</span>
        </div>
      )}
      {data?.error && (
        <div className="response-status-bar error">{responseSummary(data)}</div>
      )}

      <div className="sub-tabs-bar">
        <div className="sub-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`sub-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {tab.id === 'headers' && headerCount > 0 && (
                <span className="sub-tab-badge">{headerCount}</span>
              )}
              {tab.id === 'cookies' && cookieCount > 0 && (
                <span className="sub-tab-badge">{cookieCount}</span>
              )}
            </button>
          ))}
        </div>
        {activeTab === 'body' && (
          <div className="format-toolbar">
            {format !== 'preview' && (
              <label className="pretty-toggle">
                <input
                  type="checkbox"
                  checked={pretty}
                  onChange={(e) => setPretty(e.target.checked)}
                />
                {prettyLabel}
              </label>
            )}
            <div className="format-selector">
              <button className="format-btn" onClick={() => setFormatOpen(!formatOpen)}>
                {FORMATS.find((f) => f.id === format)?.label ?? 'JSON'}
                <ChevronDown size={12} />
              </button>
              {formatOpen && (
                <div className="format-dropdown">
                  {FORMATS.map((f) => (
                    <button
                      key={f.id}
                      className={`format-option ${format === f.id ? 'active' : ''}`}
                      onClick={() => {
                        setFormat(f.id);
                        setFormatOpen(false);
                      }}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div
        className={`sub-tab-content selectable${usePanelLayout ? ' sub-tab-content-body' : ''}`}
      >
        {loading && <div className="response-placeholder">...</div>}
        {!loading && !data && <div className="response-placeholder">{noResponseText}</div>}
        {!loading && data && activeTab === 'body' && (
          <>
            {data.error ? (
              <ResponseBodyPanel
                body={data.error}
                format="markdown"
                pretty={false}
                error
                labels={bodyPanelLabels}
              />
            ) : format === 'preview' ? (
              <iframe
                className="response-preview-frame"
                sandbox=""
                srcDoc={data.body}
                title="preview"
              />
            ) : (
              <ResponseBodyPanel
                body={data.body}
                format={format}
                pretty={pretty}
                labels={bodyPanelLabels}
              />
            )}
          </>
        )}
        {!loading && data && activeTab === 'headers' && (
          <ResponseKvPanel
            rows={Object.entries(data.headers).map(([key, value]) => ({ key, value }))}
            labels={copyLabels}
          />
        )}
        {!loading && data && activeTab === 'cookies' && (
          <ResponseKvPanel
            rows={data.cookies.map((c) => ({ key: c.name, value: c.value }))}
            labels={copyLabels}
          />
        )}
      </div>
    </div>
  );
});
