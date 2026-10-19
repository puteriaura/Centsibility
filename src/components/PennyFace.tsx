import type { SVGProps } from "react";

/** Shared original face geometry; avatars crop the full rig's face. */
export function PennyFeatures({ happy = false }: { happy?: boolean }) {
  return (
    <g>
      <circle cx="59" cy="70" r="3" fill="#15100C" />
      <circle cx="99" cy="70" r="3" fill="#15100C" />
      <path
        d={happy ? "M73 81Q79 93 85 81" : "M74 81Q79 90 84 81"}
        stroke="#34271A"
        strokeWidth=".8"
        strokeLinecap="round"
      />
    </g>
  );
}

export function PennyFace({
  size = 24,
  ...props
}: SVGProps<SVGSVGElement> & { size?: number }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="29 22 102 102"
      fill="none"
      {...props}
    >
      <ellipse cx="83" cy="73" rx="48" ry="49" fill="#D7C977" />
      <ellipse cx="79" cy="72" rx="48" ry="49" fill="#E8DC8F" />
      <PennyFeatures />
    </svg>
  );
}
