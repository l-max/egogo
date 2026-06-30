import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Search, Copy, Check, ChevronUp, ChevronDown, X } from 'lucide-react';
import type { BodyFormat } from '../../types/request';
import { ContextMenu } from '../common/ContextMenu';
import { formatResponseBody } from '../../utils/http';
import { copyTextToClipboard } from '../../utils/clipboard';
import { useSelectableCopy } from '../../hooks/useSelectableCopy';
import { findMatchCount, buildSearchParts } from '../../utils/textSearch';
import { ResponseBodyHighlighter } from './ResponseBodyHighlighter';
import './ResponseBodyPanel.css';

interface ResponseBodyPanelLabels {
  copy: string;
  copied: string;
  search: string;
  searchPlaceholder: string;
  noResults: string;
}

interface ResponseBodyPanelProps {
  body: string;
  format: Exclude<BodyFormat, 'preview'>;
  pretty: boolean;
  labels: ResponseBodyPanelLabels;
  error?: boolean;
}

function SearchableText({
  text,
  query,
  activeMatchIndex,
}: {
  text: string;
  query: string;
  activeMatchIndex: number;
}) {
  const parts = useMemo(() => buildSearchParts(text, query), [text, query]);
  const activeRef = useRef<HTMLElement>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeMatchIndex, query]);

  return (
    <pre className="response-searchable-text selectable">
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            ref={part.matchIndex === activeMatchIndex ? activeRef : undefined}
            className={
              part.matchIndex === activeMatchIndex ? 'search-mark search-mark-active' : 'search-mark'
            }
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </pre>
  );
}

export function ResponseBodyPanel({ body, format, pretty, labels, error }: ResponseBodyPanelProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [matchIndex, setMatchIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { contextMenu, setContextMenu, copySelection, onContextMenu } = useSelectableCopy(
    contentRef,
    {
      skipCopyWhen: () =>
        Boolean(searchInputRef.current && document.activeElement === searchInputRef.current),
    }
  );

  const displayText = useMemo(
    () => formatResponseBody(body, format, pretty),
    [body, format, pretty]
  );
  const matchCount = useMemo(
    () => findMatchCount(displayText, searchQuery),
    [displayText, searchQuery]
  );

  useEffect(() => {
    setMatchIndex(0);
  }, [searchQuery, displayText]);

  useEffect(() => {
    if (matchCount === 0) {
      setMatchIndex(0);
    } else if (matchIndex >= matchCount) {
      setMatchIndex(matchCount - 1);
    }
  }, [matchCount, matchIndex]);

  const openSearch = useCallback(() => {
    setSearchOpen(true);
    setTimeout(() => searchInputRef.current?.focus(), 0);
  }, []);

  const closeSearch = useCallback(() => {
    setSearchOpen(false);
    setSearchQuery('');
    setMatchIndex(0);
  }, []);

  const nextMatch = useCallback(() => {
    if (matchCount === 0) return;
    setMatchIndex((i) => (i + 1) % matchCount);
  }, [matchCount]);

  const prevMatch = useCallback(() => {
    if (matchCount === 0) return;
    setMatchIndex((i) => (i - 1 + matchCount) % matchCount);
  }, [matchCount]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        openSearch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [openSearch]);

  async function handleCopyAll() {
    await copyTextToClipboard(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const showSearchHighlight = searchOpen && searchQuery.length > 0;

  return (
    <div className={`response-body-panel${error ? ' response-body-panel-error' : ''}`}>
      <div className="response-body-toolbar">
        {searchOpen ? (
          <div className="response-search-bar">
            <Search size={14} className="response-search-icon" />
            <input
              ref={searchInputRef}
              className="response-search-input selectable"
              value={searchQuery}
              placeholder={labels.searchPlaceholder}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && e.shiftKey) {
                  e.preventDefault();
                  prevMatch();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  nextMatch();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  closeSearch();
                }
              }}
            />
            <span className="response-search-counter">
              {searchQuery
                ? matchCount > 0
                  ? `${matchIndex + 1}/${matchCount}`
                  : labels.noResults
                : ''}
            </span>
            <button
              className="response-body-action"
              onClick={prevMatch}
              disabled={matchCount === 0}
              title="↑"
            >
              <ChevronUp size={14} />
            </button>
            <button
              className="response-body-action"
              onClick={nextMatch}
              disabled={matchCount === 0}
              title="↓"
            >
              <ChevronDown size={14} />
            </button>
            <button className="response-body-action" onClick={closeSearch} title="Esc">
              <X size={14} />
            </button>
          </div>
        ) : (
          <button className="response-body-action" onClick={openSearch} title={labels.search}>
            <Search size={14} />
          </button>
        )}
        <button className="response-body-action copy-action" onClick={handleCopyAll} title={labels.copy}>
          {copied ? <Check size={14} /> : <Copy size={14} />}
          <span>{copied ? labels.copied : labels.copy}</span>
        </button>
      </div>

      <div
        ref={contentRef}
        className="response-body-content selectable"
        onContextMenu={onContextMenu}
      >
        {showSearchHighlight ? (
          <SearchableText
            text={displayText}
            query={searchQuery}
            activeMatchIndex={matchIndex}
          />
        ) : (
          <ResponseBodyHighlighter body={body} format={format} pretty={pretty} />
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
