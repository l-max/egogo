export async function copyTextToClipboard(text: string): Promise<void> {
  try {
    const { SetClipboard } = await import('../../wailsjs/go/main/App');
    await SetClipboard(text);
  } catch {
    await navigator.clipboard?.writeText(text);
  }
}

export function getSelectionTextWithin(container: HTMLElement | null): string {
  if (!container) return '';
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return '';
  const range = selection.getRangeAt(0);
  if (!container.contains(range.commonAncestorContainer)) return '';
  return selection.toString();
}
