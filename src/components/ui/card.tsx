import { ReactNode } from "react";

export interface CardProps extends React.HTMLAttributes<HTMLElement> {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({
  children,
  className = "",
  style,
  ...props
}: CardProps) {
  return (
    <section className={`wireframe-card ${className}`} style={style} {...props}>
      {children}
    </section>
  );
}
