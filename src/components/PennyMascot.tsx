import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import "./penny-mascot.css";

export type PennyState =
  | "neutral"
  | "welcome"
  | "guide"
  | "happy"
  | "encouraging"
  | "attentive"
  | "proud"
  | "celebrate"
  | "reassuring"
  | "loading"
  | "saved"
  | "unavailable";

// These are our own checked-in SVGs, never server-supplied markup.
const artwork = import.meta.glob<string>("../assets/penny/*.svg", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function PennyMascot({
  state = "neutral",
  size = 80,
  label,
  className = "",
}: {
  state?: PennyState;
  size?: number;
  label?: string;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const id = useId();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    let visible = true;
    const update = () => setPaused(document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", update);
    update();
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  const source = artwork[`../assets/penny/${state}.svg`]
    .replaceAll(`penny-${state}-title`, `${id}-title`)
    .replaceAll(`penny-${state}-desc`, `${id}-desc`);
  return (
    <span
      ref={ref}
      className={cn("penny-mascot", className)}
      data-state={state}
      data-paused={paused || undefined}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <span
        key={state}
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: source }}
      />
    </span>
  );
}
