import * as React from "react";
import { Link } from "@tanstack/react-router";
import { AppIcon } from "@/components/ui/app-icon";

export interface QuickActionProps {
  to?: string;
  onClick?: () => void;
  icon: string;
  label: string;
  description?: string;
  badge?: string | number;
  variant?: "default" | "soft" | "highlight";
  className?: string;
}

export function QuickAction({
  to,
  onClick,
  icon,
  label,
  description,
  badge,
  variant = "default",
  className = "",
}: QuickActionProps) {
  const content = (
    <div
      className={`quick-action-tile ${
        variant === "soft"
          ? "quick-action-tile--soft"
          : variant === "highlight"
            ? "quick-action-tile--highlight"
            : ""
      } ${className}`.trim()}
    >
      {badge !== undefined && (
        <span className="absolute top-2 right-2 bg-[var(--primary)] text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center z-10">
          {badge}
        </span>
      )}
      <div className="quick-action-tile__icon" aria-hidden="true">
        <AppIcon name={icon} size={22} />
      </div>
      <strong className="quick-action-tile__label">
        {label}
      </strong>
      {description && (
        <span className="quick-action-tile__desc">
          {description}
        </span>
      )}
    </div>
  );

  if (to) {
    return (
      <Link to={to} className="quick-action-link" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="quick-action-btn"
      style={{ width: "100%", padding: 0, border: "none", background: "transparent", textAlign: "left", cursor: "pointer", display: "block" }}
    >
      {content}
    </button>
  );
}
