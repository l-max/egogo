import { memo, useMemo } from 'react';
import { PrismLight as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/prism/json';
import markup from 'react-syntax-highlighter/dist/esm/languages/prism/markup';
import yaml from 'react-syntax-highlighter/dist/esm/languages/prism/yaml';
import javascript from 'react-syntax-highlighter/dist/esm/languages/prism/javascript';
import markdown from 'react-syntax-highlighter/dist/esm/languages/prism/markdown';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import type { BodyFormat } from '../../types/request';
import { formatResponseBody } from '../../utils/http';
import './ResponseBodyHighlighter.css';

SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('html', markup);
SyntaxHighlighter.registerLanguage('xml', markup);
SyntaxHighlighter.registerLanguage('yaml', yaml);
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('markdown', markdown);

const FORMAT_LANGUAGE: Record<Exclude<BodyFormat, 'preview'>, string> = {
  json: 'json',
  xml: 'xml',
  html: 'html',
  yaml: 'yaml',
  javascript: 'javascript',
  markdown: 'markdown',
};

const codeTheme = {
  ...oneDark,
  'pre[class*="language-"]': {
    ...oneDark['pre[class*="language-"]'],
    background: 'var(--bg-primary)',
    margin: 0,
    padding: '12px',
    textAlign: 'left' as const,
    borderRadius: 0,
  },
  'code[class*="language-"]': {
    ...oneDark['code[class*="language-"]'],
    background: 'transparent',
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    lineHeight: '1.5',
    textAlign: 'left' as const,
  },
};

interface ResponseBodyHighlighterProps {
  body: string;
  format: Exclude<BodyFormat, 'preview'>;
  pretty: boolean;
}

export const ResponseBodyHighlighter = memo(function ResponseBodyHighlighter({
  body,
  format,
  pretty,
}: ResponseBodyHighlighterProps) {
  const language = FORMAT_LANGUAGE[format];
  const code = useMemo(() => formatResponseBody(body, format, pretty), [body, format, pretty]);

  return (
    <div className="response-code-wrap selectable">
      <SyntaxHighlighter
        language={language}
        style={codeTheme}
        PreTag="div"
        customStyle={{ margin: 0, background: 'transparent' }}
        wrapLongLines={false}
      >
        {code || '(empty)'}
      </SyntaxHighlighter>
    </div>
  );
});
