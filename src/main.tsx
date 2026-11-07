import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
import "./reference-theme.css";
import "./responsive-shell.css";

// Polyfill AsyncLocalStorage for client-side compatibility
declare global {
  interface Window {
    AsyncLocalStorage?: unknown;
  }
}

if (typeof window !== "undefined") {
  window.AsyncLocalStorage = class {
    getStore() {
      return null;
    }
    run(_store: unknown, callback: () => unknown) {
      return callback();
    }
  };
}

const router = getRouter();

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root")!;
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
