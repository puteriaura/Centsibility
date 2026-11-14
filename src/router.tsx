import { createRouter } from "@tanstack/react-router";
import { activeViewTransition, navigationMotion } from "@/lib/motion";
import { routeTree } from "./routeTree.gen";
import { DefaultErrorComponent } from "./routes/__root";

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    scrollRestoration: true,
    defaultViewTransition: {
      types: ({ fromLocation, toLocation }) => {
        // A second tap may skip the previous snapshot; that is normal cancellation.
        void activeViewTransition()?.ready.catch(() => {});
        return [navigationMotion(fromLocation?.pathname, toLocation.pathname)];
      },
    },
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: DefaultErrorComponent,
  });

  return router;
};
