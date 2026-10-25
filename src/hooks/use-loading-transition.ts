import { useCallback, useRef, useState } from "react";

/** Reveal initial data once. Section CSS fades it in without another snapshot. */
export function useLoadingTransition() {
  const [loading, setLoading] = useState(true);
  const pending = useRef(true);
  const finishLoading = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    setLoading(false);
  }, []);
  return [loading, finishLoading] as const;
}
