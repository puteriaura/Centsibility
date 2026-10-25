import { activeViewTransition } from "@/lib/motion";
import { useCallback, useRef, useState } from "react";
import { flushSync } from "react-dom";

/** Cross-fade the initial skeleton into data, without animating later polls. */
export function useLoadingTransition() {
  const [loading, setLoading] = useState(true);
  const pending = useRef(true);
  const finishLoading = useCallback(() => {
    if (!pending.current) return;
    pending.current = false;
    if (typeof document !== "undefined" && document.startViewTransition && "activeViewTransition" in document) {
      const reveal = async () => {
        // Let the router finish its own snapshot before replacing a skeleton.
        let active;
        while ((active = activeViewTransition())) await active.finished.catch(() => {});
        const transition = document.startViewTransition(() => flushSync(() => setLoading(false)));
        void transition.ready.catch(() => {});
        void transition.finished.catch(() => {});
      };
      void reveal();
    } else setLoading(false);
  }, []);
  return [loading, finishLoading] as const;
}
