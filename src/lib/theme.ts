import { useState } from "react";

export function getTheme(): "light" | "dark" {
  return "light";
}

export function applyTheme(_t: "light" | "dark") {
  // Wireframe: no color theme classes applied
}

export function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const toggle = () => {
    setTheme((t) => (t === "dark" ? "light" : "dark"));
  };
  return { theme, toggle };
}
