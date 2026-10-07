import { useCallback, useLayoutEffect, useRef } from "react";
export function useAutoResizeTextarea({ minHeight, maxHeight, value }: { minHeight: number; maxHeight: number; value: string }) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const adjustHeight = useCallback((reset = false) => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = `${minHeight}px`;
    const height = reset ? minHeight : Math.min(Math.max(element.scrollHeight, minHeight), maxHeight);
    element.style.height = `${height}px`;
    element.style.overflowY = element.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [minHeight, maxHeight]);
  useLayoutEffect(() => { adjustHeight(); }, [adjustHeight, value]);
  return { textareaRef, adjustHeight };
}
