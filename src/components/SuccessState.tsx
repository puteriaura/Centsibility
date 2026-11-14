import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";

export interface SuccessStateProps {
  title: string;
  detail?: string;
  buttonText?: string;
  onAction?: () => void;
  className?: string;
}

export function SuccessState({
  title,
  detail,
  buttonText = "Give again",
  onAction,
  className = "",
}: SuccessStateProps) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const { reduced } = useTheme();

  useEffect(() => {
    titleRef.current?.focus();
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(12);
    }
  }, []);

  return (
    <motion.div
      role="status"
      className={`success-state ${className}`}
      aria-live="polite"
      initial={reduced ? { opacity: 0 } : undefined}
      animate={reduced ? { opacity: 1 } : undefined}
      transition={{ duration: 0.12 }}
    >
      <div className="success-state__icon" aria-hidden="true">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <motion.path
            d="M5 13l4 4L19 7"
            stroke="currentColor"
            strokeWidth="2.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={reduced ? false : { pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={reduced ? { duration: 0.12 } : { duration: 0.32, ease: "easeOut" }}
          />
        </svg>
      </div>
      <motion.h3
        ref={titleRef}
        tabIndex={-1}
        className="success-state__title"
        initial={reduced ? { opacity: 0 } : { y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={reduced ? { duration: 0.12 } : { duration: 0.3, ease: "easeOut" }}
      >
        {title}
      </motion.h3>
      {detail && <p className="success-state__detail">{detail}</p>}
      {onAction && (
        <Button
          type="button"
          variant="primary"
          onClick={onAction}
          className="min-w-[140px]"
        >
          {buttonText}
        </Button>
      )}
    </motion.div>
  );
}
