(() => {
  const read = (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  };
  const preference = read("centsibility.appearance");
  const theme = preference === "dark" || (preference !== "light" && matchMedia("(prefers-color-scheme: dark)").matches) ? "dark" : "light";
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = theme === "dark" ? "#0F121A" : "#F5F6FA";
  document.documentElement.dataset.motion = read("centsibility.reduce-animations") === "true" || matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduced" : "full";
  document.documentElement.dataset.route = location.pathname === "/" ? "landing" : "app";
})();
