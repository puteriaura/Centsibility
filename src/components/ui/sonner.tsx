import React from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      // Sit above the bottom dock instead of covering its labels.
      offset={{ bottom: 104 }}
      mobileOffset={{ bottom: 104 }}
      toastOptions={{
        style: {
          border: "none",
          background: "var(--surface)",
          color: "var(--ink)",
          borderRadius: "16px",
          boxShadow: "var(--shadow-xl)",
          fontFamily: "var(--font-text)",
          fontSize: "14px",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
