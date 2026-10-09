import { Outlet, Link, createRootRoute, useRouter } from "@tanstack/react-router";
import { AuthProvider } from "@/providers/auth";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { useTheme } from "@/lib/theme";
import { purgeStoredCredentials } from "@/lib/quick-login";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { observeViewport } from "@/lib/viewport";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";

function NotFoundComponent() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[var(--canvas)]">
      <Card variant="default" className="max-w-md w-full p-6 rounded-3xl">
        <div className="w-14 h-14 mb-4 rounded-full bg-[var(--action-tint)] text-[var(--action)] flex items-center justify-center">
          <AppIcon name="compass" size={30} />
        </div>
        <p className="m-0 section-title__heading">Error 404</p>
        <h1 className="text-2xl font-bold text-[var(--ink)] mt-2">Page not found</h1>
        <p className="text-sm text-[var(--text-2)] mt-2 leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex">
          <Link
            to="/"
            className="inline-flex h-11 items-center rounded-full bg-[var(--action)] px-5 text-sm font-semibold text-white no-underline hover:bg-[var(--action-pressed)] hover:text-white"
          >
            Go to the start page
          </Link>
        </div>
      </Card>
    </div>
  );
}

export function DefaultErrorComponent({ error, reset }: { error: Error; reset?: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[var(--canvas)]">
      <Card variant="default" className="max-w-md w-full p-6 rounded-3xl">
        <div className="w-14 h-14 mb-4 rounded-full bg-[var(--neg-bg)] text-[var(--neg)] flex items-center justify-center">
          <AppIcon name="close" size={30} />
        </div>
        <h1 className="text-2xl font-bold text-[var(--ink)]">Something went wrong</h1>
        <p className="text-sm text-[var(--text-2)] mt-2 leading-relaxed">
          {error?.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-6 flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
          >
            Try again
          </Button>
          <Link to="/" className="text-sm font-semibold text-[var(--action-text)] no-underline">
            Go to the start page
          </Link>
        </div>
      </Card>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: DefaultErrorComponent as any,
});

function RootComponent() {
  useTheme();
  useEffect(observeViewport, []);
  useEffect(() => {
    purgeStoredCredentials();
  }, []);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Outlet />
        <Toaster />
      </AuthProvider>
    </ErrorBoundary>
  );
}
