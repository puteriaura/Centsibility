export interface PrivacyState {
  locked: boolean;
  hidden: boolean;
}

export type PrivacyAction =
  | { type: "LOCK" }
  | { type: "UNLOCK" }
  | { type: "TOGGLE_HIDDEN" }
  | { type: "SET_HIDDEN"; hidden: boolean };

export const STORAGE_KEY_HIDDEN = "centsibility.privacy.hidden";

export function loadSavedHidden(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_HIDDEN) === "true";
  } catch {
    return false;
  }
}

export function saveHidden(hidden: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_HIDDEN, hidden ? "true" : "false");
  } catch {
    // Ignore quota/security errors
  }
}

export function createInitialPrivacyState(options?: {
  initialLocked?: boolean;
  initialHidden?: boolean;
}): PrivacyState {
  return {
    locked: options?.initialLocked ?? true,
    hidden: options?.initialHidden ?? loadSavedHidden(),
  };
}

export function privacyReducer(
  state: PrivacyState,
  action: PrivacyAction,
): PrivacyState {
  switch (action.type) {
    case "LOCK":
      if (state.locked) return state;
      return { ...state, locked: true };

    case "UNLOCK":
      if (!state.locked) return state;
      return { ...state, locked: false };

    case "TOGGLE_HIDDEN": {
      const nextHidden = !state.hidden;
      saveHidden(nextHidden);
      return { ...state, hidden: nextHidden };
    }

    case "SET_HIDDEN": {
      saveHidden(action.hidden);
      return { ...state, hidden: action.hidden };
    }

    default:
      return state;
  }
}

export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export function createIdleLockTimer(
  onLock: () => void,
  timeoutMs: number = IDLE_TIMEOUT_MS,
): () => void {
  if (typeof window === "undefined") return () => {};

  let timer: ReturnType<typeof setTimeout> | null = null;

  const resetTimer = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      onLock();
    }, timeoutMs);
  };

  resetTimer();

  const activityEvents = [
    "pointerdown",
    "mousedown",
    "touchstart",
    "keydown",
    "scroll",
  ] as const;

  const handleActivity = () => {
    resetTimer();
  };

  activityEvents.forEach((ev) => {
    window.addEventListener(ev, handleActivity, { passive: true });
  });

  return () => {
    if (timer) clearTimeout(timer);
    activityEvents.forEach((ev) => {
      window.removeEventListener(ev, handleActivity);
    });
  };
}

export function createVisibilityLockListener(onLock: () => void): () => void {
  if (typeof document === "undefined") return () => {};

  const handleVisibility = () => {
    if (document.visibilityState === "hidden") {
      onLock();
    }
  };

  document.addEventListener("visibilitychange", handleVisibility);
  return () => {
    document.removeEventListener("visibilitychange", handleVisibility);
  };
}
