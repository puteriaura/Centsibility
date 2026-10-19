import { useEffect, useSyncExternalStore } from "react";

export type ThemePreference = "light" | "dark" | "system";
export const THEME_KEY = "centsibility.appearance";
export const MOTION_KEY = "centsibility.reduce-animations";
const changeEvent = "centsibility:appearance";
const fallback: Record<string, string> = {};
function read(key: string) {
  try { return window.localStorage.getItem(key) ?? fallback[key] ?? null; } catch { return fallback[key] ?? null; }
}
export function normalizeTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
export function resolveTheme(preference: ThemePreference, systemDark: boolean): "light" | "dark" {
  return preference === "system" ? systemDark ? "dark" : "light" : preference;
}
export function getTheme() {
  return resolveTheme(normalizeTheme(read(THEME_KEY)), typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches);
}
export function applyTheme(theme: "light" | "dark") {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  // Tint the browser status bar with the app canvas, not a fixed brand blue.
  const canvas = getComputedStyle(document.documentElement)
    .getPropertyValue("--canvas")
    .trim();
  if (canvas)
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", canvas);
}
export function reduceAnimations() {
  return read(MOTION_KEY) === "true" || (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
}
function snapshot() {
  return `${normalizeTheme(read(THEME_KEY))}:${getTheme()}:${read(MOTION_KEY) === "true"}:${reduceAnimations()}`;
}
function subscribe(listener: () => void) {
  const dark = window.matchMedia("(prefers-color-scheme: dark)");
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  window.addEventListener("storage", listener);
  window.addEventListener(changeEvent, listener);
  dark.addEventListener("change", listener);
  motion.addEventListener("change", listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(changeEvent, listener);
    dark.removeEventListener("change", listener);
    motion.removeEventListener("change", listener);
  };
}
function persist(key: string, value: string) {
  try { window.localStorage.setItem(key, value); delete fallback[key]; } catch { fallback[key] = value; }
  window.dispatchEvent(new Event(changeEvent));
}
export function useTheme() {
  const value = useSyncExternalStore(subscribe, snapshot, () => "system:light:false:false");
  const [preference, theme, motionPreference, reduced] = value.split(":");
  useEffect(() => {
    applyTheme(theme as "light" | "dark");
    document.documentElement.dataset.motion = reduced === "true" ? "reduced" : "full";
  }, [theme, reduced]);
  return { preference: preference as ThemePreference, theme: theme as "light" | "dark", reduced: reduced === "true",
    motionPreference: motionPreference === "true", setPreference: (next: ThemePreference) => persist(THEME_KEY, next),
    setMotionPreference: (next: boolean) => persist(MOTION_KEY, String(next)) };
}
