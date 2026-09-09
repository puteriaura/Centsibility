import { ReactNode } from "react";

export interface SectionTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  action?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function SectionTitle({
  children,
  action,
  className = "",
  style,
  ...props
}: SectionTitleProps) {
  return (
    <div
      className={`wireframe-space-between ${className}`}
      style={{ margin: "1rem 0 0.5rem 0", ...style }}
      {...props}
    >
      <h2>{children}</h2>
      {action}
    </div>
  );
}
