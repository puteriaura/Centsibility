import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";

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

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  return (
    <div
      role="status"
      className={`success-state ${className}`}
      aria-live="polite"
    >
      <div className="success-state__icon" aria-hidden="true">
        <AppIcon name="check" size={32} />
      </div>
      <h3
        ref={titleRef}
        tabIndex={-1}
        className="success-state__title"
      >
        {title}
      </h3>
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
    </div>
  );
}
