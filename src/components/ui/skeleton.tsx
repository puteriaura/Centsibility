import React from "react";

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`wireframe-box ${className || ""}`}
      style={{ minHeight: "1.5rem", border: "1px dashed #999", padding: "0.25rem 0.5rem" }}
      {...props}
    >
      <span style={{ fontSize: "0.75rem", color: "#666" }}>[loading...]</span>
    </div>
  );
}

export { Skeleton };
