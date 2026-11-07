import { useSyncExternalStore } from "react";

const query = "(min-width: 768px)";
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(query);
  media.addEventListener("change", notify);
  return () => media.removeEventListener("change", notify);
};

/** Keep overlay direction in sync with the shared CSS breakpoint. */
export function useWideLayout() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}
