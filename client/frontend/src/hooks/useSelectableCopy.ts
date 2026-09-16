import { useState, useEffect, useCallback, type RefObject } from 'react';
import { copyTextToClipboard, getSelectionTextWithin } from '../utils/clipboard';

interface UseSelectableCopyOptions {
  enabled?: boolean;
  skipCopyWhen?: () => boolean;
}

export function useSelectableCopy(
  contentRef: RefObject<HTMLElement | null>,
  options: UseSelectableCopyOptions = {}
) {
  const { enabled = true, skipCopyWhen } = options;
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const copySelection = useCallback(async () => {
    const text = getSelectionTextWithin(contentRef.current);
    if (!text) return;
    await copyTextToClipboard(text);
  }, [contentRef]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const text = getSelectionTextWithin(contentRef.current);
      if (!text) return;
      setContextMenu({ x: e.clientX, y: e.clientY });
    },
    [contentRef]
  );

  useEffect(() => {
    if (!enabled) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.key.toLowerCase() !== 'c' || e.altKey) return;
      if (skipCopyWhen?.()) return;

      const text = getSelectionTextWithin(contentRef.current);
      if (!text) return;

      e.preventDefault();
      void copyTextToClipboard(text);
    };

    const onCopy = (e: ClipboardEvent) => {
      if (skipCopyWhen?.()) return;

      const text = getSelectionTextWithin(contentRef.current);
      if (!text) return;

      e.preventDefault();
      void copyTextToClipboard(text);
    };

    window.addEventListener('keydown', onKeyDown);
    document.addEventListener('copy', onCopy);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('copy', onCopy);
    };
  }, [contentRef, enabled, skipCopyWhen]);

  return { contextMenu, setContextMenu, copySelection, onContextMenu };
}
