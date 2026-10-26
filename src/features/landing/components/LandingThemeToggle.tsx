import { AppIcon } from "@/components/ui/app-icon";
import { useTheme } from "@/lib/theme";

export function LandingThemeToggle() {
  const { theme, setPreference } = useTheme();
  return (
    <button
      type="button"
      className="landing-theme-toggle"
      aria-label="Dark mode"
      aria-pressed={theme === "dark"}
      onClick={() => setPreference(theme === "dark" ? "light" : "dark")}
    >
      <AppIcon name={theme === "dark" ? "sun" : "moon"} size={22} />
    </button>
  );
}
