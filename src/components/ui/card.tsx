import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /**
   * default = clean white card with subtle border & shadow
   * soft = light pink tinted background
   * brand = signature AEON magenta solid fill with white text
   * navy = deep navy background with high contrast
   * outlined = transparent background with crisp border
   * interactive = card with hover elevation and press feedback
   */
  variant?: "default" | "soft" | "brand" | "navy" | "outlined" | "interactive";
}

export function Card({
  children,
  className = "",
  style,
  variant = "default",
  ...props
}: CardProps) {
  const variantClassMap: Record<NonNullable<CardProps["variant"]>, string> = {
    default: "",
    soft: "card-soft",
    brand: "card-brand",
    navy: "card-navy",
    outlined: "border border-[var(--border)] bg-transparent shadow-none",
    interactive:
      "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md cursor-pointer",
  };

  const variantClass = variantClassMap[variant] || "";

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

export function CardHeader({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`card-header ${className}`.trim()}
      style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1rem", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`card-title ${className}`.trim()}
      style={{
        margin: 0,
        fontSize: "1.125rem",
        fontWeight: 700,
        color: "var(--ink)",
        letterSpacing: "-0.01em",
        ...style,
      }}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`card-description ${className}`.trim()}
      style={{
        margin: 0,
        fontSize: "0.8125rem",
        color: "var(--text-secondary)",
        lineHeight: 1.4,
        ...style,
      }}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`card-content ${className}`.trim()}
      style={style}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`card-footer ${className}`.trim()}
      style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem", ...style }}
      {...props}
    >
      {children}
    </div>
  );
}

