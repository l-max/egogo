import { useRef, useState, useCallback, useEffect } from 'react';

export function useSplitPanel(initial = 50) {
  const panelRef = useRef<HTMLDivElement>(null);
  const ratioRef = useRef(initial);
  const [splitRatio, setSplitRatio] = useState(initial);

  const applyRatio = useCallback((ratio: number) => {
    ratioRef.current = ratio;
    if (panelRef.current) {
      panelRef.current.style.gridTemplateRows = `${ratio}fr 4px ${100 - ratio}fr`;
    }
  }, []);

  useEffect(() => {
    applyRatio(splitRatio);
  }, [applyRatio, splitRatio]);

  const onDividerMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const panel = panelRef.current;
      if (!panel) return;

      const startY = e.clientY;
      const startRatio = ratioRef.current;
      document.body.classList.add('split-resizing');

      let raf = 0;
      const onMove = (ev: MouseEvent) => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          const delta = ((ev.clientY - startY) / panel.clientHeight) * 100;
          applyRatio(Math.min(80, Math.max(20, startRatio + delta)));
        });
      };

      const onUp = () => {
        cancelAnimationFrame(raf);
        document.body.classList.remove('split-resizing');
        setSplitRatio(ratioRef.current);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    },
    [applyRatio]
  );

  return { panelRef, onDividerMouseDown };
}
