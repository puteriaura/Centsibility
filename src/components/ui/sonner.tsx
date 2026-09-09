import React from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      toastOptions={{
        style: {
          border: "1px solid #777",
          background: "#fff",
          color: "#000",
          borderRadius: "0px",
          boxShadow: "none",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
