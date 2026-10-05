import * as React from "react";
import {
  privacyReducer,
  createInitialPrivacyState,
  PrivacyState,
  createIdleLockTimer,
  createVisibilityLockListener,
  IDLE_TIMEOUT_MS,
} from "./privacy-reducer";
import { PrivacyUnlockSheet } from "./PrivacyUnlockSheet";

export interface PrivacyContextValue extends PrivacyState {
  isMasked: boolean;
  lock: () => void;
  unlock: () => void;
  toggleHidden: () => void;
  setHidden: (hidden: boolean) => void;
  openUnlockSheet: () => void;
  closeUnlockSheet: () => void;
}

const PrivacyContext = React.createContext<PrivacyContextValue | null>(null);

const JUST_UNLOCKED_KEY = "centsibility.just_unlocked";

export function markJustUnlocked() {
  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(JUST_UNLOCKED_KEY, "1");
    } catch {
      // Ignore
    }
  }
}

export function wasJustUnlocked(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const val = sessionStorage.getItem(JUST_UNLOCKED_KEY);
    if (val === "1") {
      sessionStorage.removeItem(JUST_UNLOCKED_KEY);
      return true;
    }
  } catch {
    // Ignore
  }
  return false;
}

export interface PrivacyProviderProps {
  children: React.ReactNode;
  mode?: "kid" | "parent";
  initialLocked?: boolean;
}

export function PrivacyProvider({
  children,
  mode = "kid",
  initialLocked,
}: PrivacyProviderProps) {
  // If explicitly given initialLocked, use it.
  // Otherwise check if this was a fresh login/PIN verification.
  // If not fresh login, fresh load with saved session starts locked.
  const startsLocked =
    typeof initialLocked === "boolean" ? initialLocked : !wasJustUnlocked();

  const [state, dispatch] = React.useReducer(
    privacyReducer,
    { initialLocked: startsLocked },
    createInitialPrivacyState,
  );

  const [sheetOpen, setSheetOpen] = React.useState(false);

  const lock = React.useCallback(() => dispatch({ type: "LOCK" }), []);
  const unlock = React.useCallback(() => dispatch({ type: "UNLOCK" }), []);
  const toggleHidden = React.useCallback(
    () => dispatch({ type: "TOGGLE_HIDDEN" }),
    [],
  );
  const setHidden = React.useCallback(
    (hidden: boolean) => dispatch({ type: "SET_HIDDEN", hidden }),
    [],
  );

  const openUnlockSheet = React.useCallback(() => setSheetOpen(true), []);
  const closeUnlockSheet = React.useCallback(() => setSheetOpen(false), []);

  // Idle timer: 5 minutes with no tap, key press or scroll
  React.useEffect(() => {
    return createIdleLockTimer(lock, IDLE_TIMEOUT_MS);
  }, [lock]);

  // Background lock: visibilitychange -> hidden
  React.useEffect(() => {
    return createVisibilityLockListener(lock);
  }, [lock]);

  const isMasked = state.locked || state.hidden;

  const value = React.useMemo<PrivacyContextValue>(
    () => ({
      locked: state.locked,
      hidden: state.hidden,
      isMasked,
      lock,
      unlock,
      toggleHidden,
      setHidden,
      openUnlockSheet,
      closeUnlockSheet,
    }),
    [
      state.locked,
      state.hidden,
      isMasked,
      lock,
      unlock,
      toggleHidden,
      setHidden,
      openUnlockSheet,
      closeUnlockSheet,
    ],
  );

  return (
    <PrivacyContext.Provider value={value}>
      {children}
      <PrivacyUnlockSheet
        isOpen={sheetOpen}
        onClose={closeUnlockSheet}
        onSuccess={unlock}
        mode={mode}
      />
    </PrivacyContext.Provider>
  );
}

export function usePrivacy(): PrivacyContextValue {
  const ctx = React.useContext(PrivacyContext);
  if (!ctx) {
    // Fallback if rendered outside PrivacyProvider
    return {
      locked: false,
      hidden: false,
      isMasked: false,
      lock: () => {},
      unlock: () => {},
      toggleHidden: () => {},
      setHidden: () => {},
      openUnlockSheet: () => {},
      closeUnlockSheet: () => {},
    };
  }
  return ctx;
}
