import React from "react";

function Skeleton({
  className = "",
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`ui-skeleton ${className}`.trim()}
      style={style}
      aria-hidden="true"
      {...props}
    />
  );
}

export { Skeleton };
