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
      className={`section-title ${className}`.trim()}
      style={style}
      {...props}
    >
      <h2 className="section-title__heading">{children}</h2>
      {action ? <div className="section-title__action">{action}</div> : null}
    </div>
  );
}
