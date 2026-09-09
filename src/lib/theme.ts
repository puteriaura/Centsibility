import { useEffect, useState } from "react";

const KEY = "centsibility.theme";

export function getTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem(KEY) as "light" | "dark") || "light";
}

export function applyTheme(t: "light" | "dark") {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  localStorage.setItem(KEY, t);
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const t = getTheme();
    setTheme(t);
    applyTheme(t);
  }, []);
  const toggle = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  };
  return { theme, toggle };
}
