import * as React from "react";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  /**
   * default = flat white panel on the grey canvas (no border, no shadow)
   * soft = pale blue notice panel
   * brand = the screen's one solid blue block (balance card)
   * navy = solid ink block
   * outlined = transparent with a hairline, for panels inside white containers
   * interactive = default panel that responds to hover and press
   */
  variant?: "default" | "soft" | "brand" | "navy" | "outlined" | "interactive";
}

const VARIANT_CLASS: Record<NonNullable<CardProps["variant"]>, string> = {
  default: "",
  soft: "card-soft",
  brand: "card-brand",
  navy: "card-navy",
  outlined: "border border-[var(--line)] bg-transparent",
  interactive:
    "cursor-pointer transition-colors duration-150 hover:bg-[var(--surface-hover)]",
};

export function Card({
  children,
  className = "",
  style,
  variant = "default",
  ...props
}: CardProps) {
  return (
    <section
      className={`ui-card ${VARIANT_CLASS[variant] ?? ""} ${props.onClick ? "press-feedback" : ""} ${className}`.trim()}
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
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`mb-4 flex flex-col gap-1 ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={`m-0 text-lg font-bold text-[var(--ink)] ${className}`.trim()}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={`m-0 text-sm leading-snug text-[var(--text-2)] ${className}`.trim()}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`mt-4 flex items-center justify-end gap-2 ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
