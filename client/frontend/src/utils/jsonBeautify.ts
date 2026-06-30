function removeTrailingCommas(raw: string): string {
  return raw.replace(/,\s*([}\]])/g, '$1');
}

function tryParseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function parseJsonLenient(raw: string): unknown | null {
  const candidates = [raw, removeTrailingCommas(raw)];

  for (const candidate of candidates) {
    const parsed = tryParseJson(candidate);
    if (parsed !== null) return parsed;
  }

  return null;
}

export function beautifyJson(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '{\n}\n';

  const parsed = parseJsonLenient(trimmed);
  if (parsed !== null) {
    return `${JSON.stringify(parsed, null, 2)}\n`;
  }

  return prettyPrintJsonStructure(trimmed);
}

/** Best-effort layout when JSON cannot be parsed at all */
function prettyPrintJsonStructure(raw: string): string {
  let indent = 0;
  let result = '';
  let inString = false;
  let stringQuote = '';
  let escape = false;

  const writeIndent = (extra = 0) => {
    result += '  '.repeat(Math.max(0, indent + extra));
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inString) {
      result += ch;
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === stringQuote) {
        inString = false;
        stringQuote = '';
      }
      continue;
    }

    if (ch === '"' || ch === "'") {
      inString = true;
      stringQuote = ch;
      result += ch;
      continue;
    }

    if (ch === '{' || ch === '[') {
      result += ch;
      indent++;
      result += '\n';
      writeIndent();
      continue;
    }

    if (ch === '}' || ch === ']') {
      indent = Math.max(0, indent - 1);
      result += '\n';
      writeIndent();
      result += ch;
      continue;
    }

    if (ch === ',') {
      result += ch;
      result += '\n';
      writeIndent();
      continue;
    }

    if (ch === ':') {
      result += ': ';
      continue;
    }

    if (/\s/.test(ch)) {
      continue;
    }

    result += ch;
  }

  return `${result.trim()}\n`;
}
