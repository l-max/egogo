export interface SearchPart {
  text: string;
  match?: boolean;
  matchIndex?: number;
}

export function findMatchCount(text: string, query: string): number {
  if (!query) return 0;
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
    count++;
    pos += lowerQuery.length || 1;
  }
  return count;
}

export function buildSearchParts(text: string, query: string): SearchPart[] {
  if (!query) return [{ text }];

  const parts: SearchPart[] = [];
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let lastIndex = 0;
  let matchIndex = 0;
  let pos = 0;

  while ((pos = lowerText.indexOf(lowerQuery, pos)) !== -1) {
    if (pos > lastIndex) {
      parts.push({ text: text.slice(lastIndex, pos) });
    }
    parts.push({
      text: text.slice(pos, pos + query.length),
      match: true,
      matchIndex,
    });
    matchIndex++;
    lastIndex = pos + query.length;
    pos = lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex) });
  }

  return parts.length > 0 ? parts : [{ text }];
}
