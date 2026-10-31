export function viewportGeometry(layoutHeight: number, height: number, offsetTop: number, scale = 1) {
  if (scale !== 1) return { height: Math.max(1, layoutHeight), top: 0, inset: 0 };
  return { height: Math.max(1, height), top: Math.max(0, offsetTop), inset: Math.max(0, layoutHeight - height - offsetTop) };
}

export function observeViewport() {
  const viewport = window.visualViewport;
  const update = () => {
    const geometry = viewportGeometry(window.innerHeight, viewport?.height ?? window.innerHeight, viewport?.offsetTop ?? 0, viewport?.scale ?? 1);
    const root = document.documentElement;
    root.style.setProperty("--viewport-height", `${geometry.height}px`);
    root.style.setProperty("--viewport-top", `${geometry.top}px`);
    root.style.setProperty("--keyboard-inset", `${geometry.inset}px`);
    root.dataset.keyboard = geometry.inset > 80 && Boolean(document.activeElement?.matches("input, textarea, [contenteditable=true]")) ? "open" : "closed";
  };
  const keyboard = () => { document.documentElement.dataset.input = "keyboard"; };
  const pointer = () => { document.documentElement.dataset.input = "pointer"; };
  document.addEventListener("keydown", keyboard);
  document.addEventListener("pointerdown", pointer);
  update();
  viewport?.addEventListener("resize", update);
  viewport?.addEventListener("scroll", update);
  window.addEventListener("resize", update);
  document.addEventListener("focusin", update);
  document.addEventListener("focusout", update);
  return () => {
    document.removeEventListener("keydown", keyboard);
    document.removeEventListener("pointerdown", pointer);
    viewport?.removeEventListener("resize", update);
    viewport?.removeEventListener("scroll", update);
    window.removeEventListener("resize", update);
    document.removeEventListener("focusin", update);
    document.removeEventListener("focusout", update);
  };
}
