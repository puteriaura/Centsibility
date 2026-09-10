import { ReactNode } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /** soft = lavender tint; brand = amethyst accent surface; default = white */
  variant?: "default" | "soft" | "brand";
}

export function Card({
  children,
  className = "",
  style,
  variant = "default",
  ...props
}: CardProps) {
  const variantClass =
    variant === "soft" ? "card-soft" : variant === "brand" ? "card-brand" : "";

  return (
    <section
      className={`ui-card ${variantClass} ${className}`.trim()}
      style={style}
      {...props}
    >
      {children}
    </section>
  );
}
