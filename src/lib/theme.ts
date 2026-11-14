import { useEffect, useSyncExternalStore } from "react";
import type { SeasonPreviewMode } from "@/content/ramadan";

export type ThemePreference = "light" | "dark" | "system";
export type KidCardTheme =
  | "periwinkle"
  | "pandan"
  | "senja"
  | "telang"
  | "langit"
  | "malam";
export type AppLanguage = "en" | "ms";

export interface KidCardThemeOption {
  id: KidCardTheme;
  label: string;
  card: string;
  text: string;
  ratio: string;
}

export const KID_CARD_THEMES: readonly KidCardThemeOption[] = [
  { id: "periwinkle", label: "Periwinkle", card: "#A0B0DA", text: "#151E31", ratio: "7.70:1" },
  { id: "pandan", label: "Pandan", card: "#A8D8C0", text: "#10302A", ratio: "8.96:1" },
  { id: "senja", label: "Senja", card: "#F4B8A0", text: "#3A1A10", ratio: "9.15:1" },
  { id: "telang", label: "Telang", card: "#C6B3E6", text: "#23153F", ratio: "8.79:1" },
  { id: "langit", label: "Langit", card: "#9CCBEA", text: "#0F2A3D", ratio: "8.56:1" },
  { id: "malam", label: "Malam", card: "#2A3558", text: "#EEF0F8", ratio: "10.55:1" },
];

export const THEME_KEY = "centsibility.appearance";
export const MOTION_KEY = "centsibility.reduce-animations";
export const KID_THEME_KEY = "centsibility.kid-theme";
export const LANG_KEY = "centsibility.lang";
export const SEASON_PREVIEW_KEY = "centsibility.season-preview";
const changeEvent = "centsibility:appearance";
const fallback: Record<string, string> = {};
function read(key: string) {
  try { return window.localStorage.getItem(key) ?? fallback[key] ?? null; } catch { return fallback[key] ?? null; }
}
export function normalizeTheme(value: unknown): ThemePreference {
  return value === "light" || value === "dark" ? value : "system";
}
export function normalizeKidTheme(value: unknown): KidCardTheme {
  return value === "pandan" || value === "senja" || value === "telang" || value === "langit" || value === "malam"
    ? value
    : "periwinkle";
}
export function normalizeLang(value: unknown): AppLanguage {
  return value === "ms" ? "ms" : "en";
}
export function normalizeSeasonPreview(value: unknown): SeasonPreviewMode {
  return value === "ramadan" || value === "raya" ? value : "auto";
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
  return `${normalizeTheme(read(THEME_KEY))}:${getTheme()}:${read(MOTION_KEY) === "true"}:${reduceAnimations()}:${normalizeKidTheme(read(KID_THEME_KEY))}:${normalizeLang(read(LANG_KEY))}:${normalizeSeasonPreview(read(SEASON_PREVIEW_KEY))}`;
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
  const value = useSyncExternalStore(subscribe, snapshot, () => "system:light:false:false:periwinkle:en:auto");
  const [preference, theme, motionPreference, reduced, kidTheme, lang, seasonPreview] = value.split(":");
  useEffect(() => {
    applyTheme(theme as "light" | "dark");
    document.documentElement.dataset.motion = reduced === "true" ? "reduced" : "full";
    document.documentElement.dataset.kidTheme = kidTheme;
    document.documentElement.lang = lang;
  }, [theme, reduced, kidTheme, lang]);
  return {
    preference: preference as ThemePreference,
    theme: theme as "light" | "dark",
    reduced: reduced === "true",
    motionPreference: motionPreference === "true",
    kidTheme: kidTheme as KidCardTheme,
    lang: lang as AppLanguage,
    seasonPreview: seasonPreview as SeasonPreviewMode,
    setPreference: (next: ThemePreference) => persist(THEME_KEY, next),
    setMotionPreference: (next: boolean) => persist(MOTION_KEY, String(next)),
    setKidTheme: (next: KidCardTheme) => persist(KID_THEME_KEY, next),
    setLang: (next: AppLanguage) => persist(LANG_KEY, next),
    setSeasonPreview: (next: SeasonPreviewMode) => persist(SEASON_PREVIEW_KEY, next),
  };
}
