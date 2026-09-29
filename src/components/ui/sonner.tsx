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
          background: "#fff",
          color: "var(--ink)",
          borderRadius: "16px",
          boxShadow: "0 8px 24px rgba(17, 17, 17, 0.12)",
          fontFamily: "var(--font-sans)",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
