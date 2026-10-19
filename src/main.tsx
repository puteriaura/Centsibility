import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";
import "./reference-theme.css";
import "./reference-theme.css";

// Polyfill AsyncLocalStorage for client-side compatibility
declare global {
  interface Window {
    AsyncLocalStorage?: unknown;
  }
}

import { edgeExecuteScheduledHibahs } from "@/lib/edge";

if (typeof window !== "undefined") {
  window.AsyncLocalStorage = class {
    getStore() {
      return null;
    }
    run(_store: unknown, callback: () => unknown) {
      return callback();
    }
  };

  // Trigger the edge function cron for auto-Hibah on app load and every hour
  setTimeout(() => {
    edgeExecuteScheduledHibahs().catch(() => {});
  }, 5000);
  setInterval(
    () => {
      edgeExecuteScheduledHibahs().catch(() => {});
    },
    60 * 60 * 1000,
  );
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
