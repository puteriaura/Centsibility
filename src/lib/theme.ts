import { useState } from "react";

/** Light-only for now — DESIGN.md is a light AEON-inspired system. */
export function getTheme(): "light" | "dark" {
  return "light";
}

export function applyTheme(_t: "light" | "dark") {
  document.documentElement.dataset.theme = "light";
  document.documentElement.style.colorScheme = "light";
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const toggle = () => {
    // Dark tokens not defined yet — keep light; UI toggle stays for Stage 3+ decision.
    setTheme("light");
    applyTheme("light");
  };
  return { theme, toggle };
}
