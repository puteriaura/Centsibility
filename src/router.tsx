import { createRouter } from "@tanstack/react-router";
import { activeViewTransition, navigationMotion } from "@/lib/motion";
import { routeTree } from "./routeTree.gen";
import { DefaultErrorComponent } from "./routes/__root";

if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason as { name?: string; message?: string } | undefined;
    if (reason?.name === "InvalidStateError" && String(reason?.message || "").includes("Transition was aborted")) {
      event.preventDefault();
    }
  });
}

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) => {
        // A second tap or viewport resize may abort the previous snapshot; that is normal cancellation.
        const vt = activeViewTransition();
        if (vt) {
          void vt.ready.catch(() => {});
          void vt.finished.catch(() => {});
          void vt.updateCallbackDone.catch(() => {});
        }
        return [navigationMotion(fromLocation?.pathname, toLocation.pathname)];
      },
    },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
