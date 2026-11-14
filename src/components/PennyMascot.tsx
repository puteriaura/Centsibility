import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion, useAnimationControls, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { PennyFace, PennyFeatures } from "./PennyFace";
import { useTheme } from "@/lib/theme";
import "./penny-mascot.css";

export const PENNY_POSES = {
  neutral: { left: 0, right: 0, duration: 0, lift: 0 },
  welcome: { left: 0, right: -110, duration: 1.1, lift: 0 },
  guide: { left: 0, right: -55, duration: 0.7, lift: 0 },
  happy: { left: 12, right: -12, duration: 0.6, lift: -4 },
  encouraging: { left: 0, right: -70, duration: 0.7, lift: -1 },
  attentive: { left: 0, right: -20, duration: 0.5, lift: 0 },
  proud: { left: 65, right: -65, duration: 0.8, lift: -2 },
  celebrate: { left: 115, right: -115, duration: 1.2, lift: -5 },
  reassuring: { left: 25, right: -25, duration: 0.9, lift: 0 },
  loading: { left: 0, right: -20, duration: 1.6, lift: -1 },
  saved: { left: 0, right: -45, duration: 0.5, lift: -2 },
  unavailable: { left: 15, right: -15, duration: 0.5, lift: 0 },
} as const;
export type PennyPose = keyof typeof PENNY_POSES;
export type PennyState =
  | PennyPose
  | "idle"
  | "thinking"
  | "sleepy"
  | "oops"
  | "saving"
  | "money_in"
  | "goal_reached"
  | "declined"
  | "streak_at_risk";
const aliases = {
  idle: "neutral",
  thinking: "attentive",
  sleepy: "neutral",
  oops: "unavailable",
  saving: "saved",
  money_in: "happy",
  goal_reached: "celebrate",
  declined: "unavailable",
  streak_at_risk: "neutral",
} as const;
export const pennyPose = (state: PennyState): PennyPose =>
  state in aliases
    ? aliases[state as keyof typeof aliases]
    : (state as PennyPose);

/** Original JPEG likeness, adapted to one persistent two-arm rig. No pose layers. */
export function PennyMascot({
  state = "neutral",
  size = 96,
  label,
  className = "",
}: {
  state?: PennyState;
  size?: number;
  label?: string;
  className?: string;
}) {
  const core = pennyPose(state);
  const pose = PENNY_POSES[core];
  const ref = useRef<HTMLSpanElement>(null);
  const [paused, setPaused] = useState(false);
  const [interrupted, setInterrupted] = useState<PennyState | null>(null);
  const reduced = useReducedMotion();
  const { reduced: preferenceReduced } = useTheme();
  useEffect(() => {
    let visible = true;
    const update = () => setPaused(document.hidden || !visible);
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      update();
    });
    if (ref.current) observer.observe(ref.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  useEffect(() => {
    if (paused) setInterrupted(state);
    else setInterrupted((previous) => (previous === state ? previous : null));
  }, [paused, state]);
  const still =
    !!reduced ||
    preferenceReduced ||
    paused ||
    (core !== "loading" && interrupted === state);
  const bodyMotion = useAnimationControls();
  const leftMotion = useAnimationControls();
  const rightMotion = useAnimationControls();
  useLayoutEffect(() => {
    const stop = () => {
      bodyMotion.stop();
      leftMotion.stop();
      rightMotion.stop();
    };
    stop();
    if (still) {
      bodyMotion.set({ y: 0 });
      leftMotion.set({ rotate: pose.left });
      rightMotion.set({ rotate: pose.right });
    } else {
      const transition = {
        duration: pose.duration,
        ease: "easeInOut" as const,
        repeat: core === "loading" ? Infinity : 0,
      };
      void bodyMotion.start({ y: [0, pose.lift, 0] }, transition);
      void leftMotion.start({ rotate: pose.left }, transition);
      void rightMotion.start(
        {
          rotate: core === "welcome" ? [0, -110, -90, -115, -110] : pose.right,
        },
        transition,
      );
    }
    return stop;
  }, [core, pose, still, bodyMotion, leftMotion, rightMotion]);
  return (
    <span
      ref={ref}
      className={cn("penny-mascot", className)}
      data-state={state}
      data-core-state={core}
      data-paused={paused || undefined}
      style={{ width: size, height: size }}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      {size <= 40 ? (
        <PennyFace size={size} aria-hidden="true" />
      ) : (
        <svg
          viewBox="0 0 160 160"
          width={size}
          height={size}
          fill="none"
          aria-hidden="true"
          data-penny-rig="true"
        >
          <ellipse
            cx="75"
            cy="142"
            rx="33"
            ry="4"
            fill="#193254"
            opacity=".08"
          />
          <motion.g initial={false} animate={bodyMotion}>
            <g data-limb="left-leg">
              <path
                d="M64 116L42 134"
                stroke="#785E27"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <ellipse
                cx="40"
                cy="136"
                rx="3.5"
                ry="6"
                fill="#302046"
                transform="rotate(-12 40 136)"
              />
            </g>
            <g data-limb="right-leg">
              <path
                d="M97 116L76 138"
                stroke="#785E27"
                strokeWidth="4"
                strokeLinecap="round"
              />
              <ellipse
                cx="74"
                cy="140"
                rx="3.5"
                ry="6"
                fill="#302046"
                transform="rotate(-12 74 140)"
              />
            </g>
            <motion.g
              data-limb="left-arm"
              initial={false}
              animate={leftMotion}
              style={{
                originX: "39px",
                originY: "79px",
                transformBox: "view-box",
              }}
            >
              <path
                d="M39 79Q25 88 20 101"
                stroke="#785E27"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="20" cy="101" r="2.5" fill="#785E27" />
            </motion.g>
            <motion.g
              data-limb="right-arm"
              initial={false}
              animate={rightMotion}
              style={{
                originX: "121px",
                originY: "79px",
                transformBox: "view-box",
              }}
            >
              <path
                d="M121 79Q135 88 140 101"
                stroke="#785E27"
                strokeWidth="3"
                strokeLinecap="round"
              />
              <circle cx="140" cy="101" r="2.5" fill="#785E27" />
            </motion.g>
            <g data-penny-body="true">
              <ellipse cx="83" cy="73" rx="48" ry="49" fill="#D7C977" />
              <ellipse cx="79" cy="72" rx="48" ry="49" fill="#E8DC8F" />
              <path
                d="M112 37Q135 68 118 100"
                stroke="#C9BA69"
                strokeWidth=".7"
                strokeDasharray="1 2"
              />
              {size >= 80 && (
                <g stroke="#CDBF75" strokeWidth="1.2" opacity=".22">
                  <path d="M80 39V105M93 49C77 38 57 51 68 64C72 69 87 72 91 80C100 99 68 106 60 88M77 39V105" />
                </g>
              )}
              <PennyFeatures
                happy={["happy", "proud", "celebrate", "saved"].includes(core)}
              />
            </g>
            {core === "saved" && (
              <g data-prop="savings">
                <path d="M121 107H145V131H121Z" fill="#C5DDD6" />
                <path
                  d="M127 112H139"
                  stroke="#52796A"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </g>
            )}
            {state === "goal_reached" && (
              <g data-prop="sparkles" aria-hidden="true">
                <path d="M25 32L28 24L31 32L39 35L31 38L28 46L25 38L17 35Z" fill="#DDC518" />
                <path d="M132 28L134 22L136 28L142 30L136 32L134 38L132 32L126 30Z" fill="#A0B0DA" />
                <path d="M136 74L138 69L140 74L145 76L140 78L138 83L136 78L131 76Z" fill="#DDC518" />
              </g>
            )}
            {state === "streak_at_risk" && (
              <g data-prop="sleep-z" fill="#58677E" fontSize="14" fontWeight="700" aria-hidden="true">
                <text x="122" y="34">z</text>
                <text x="134" y="22" fontSize="11">z</text>
              </g>
            )}
            {state === "thinking" && (
              <g data-prop="thinking-dots" fill="#47629A" aria-hidden="true">
                <circle cx="122" cy="30" r="3" />
                <circle cx="131" cy="24" r="3.5" />
                <circle cx="141" cy="18" r="4" />
              </g>
            )}
          </motion.g>
        </svg>
      )}
    </span>
  );
}
