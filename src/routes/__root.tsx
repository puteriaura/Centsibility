import { Outlet, Link, createRootRoute, useRouter } from "@tanstack/react-router";
import { AuthProvider } from "@/providers/auth";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { applyTheme, getTheme } from "@/lib/theme";
import { purgeStoredCredentials } from "@/lib/quick-login";
import { ErrorBoundary } from "@/components/ErrorBoundary";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AppIcon } from "@/components/ui/app-icon";

function NotFoundComponent() {
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[var(--surface-pink)]">
      <Card variant="default" className="max-w-md w-full p-8 text-center rounded-3xl shadow-lg border border-[var(--border)]">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--primary-soft)] text-[var(--primary-text)] flex items-center justify-center">
          <AppIcon name="compass" size={32} />
        </div>
        <h1 className="text-4xl font-extrabold text-[var(--primary-text)] tracking-tight">404</h1>
        <h2 className="text-xl font-bold text-[var(--ink)] mt-2">Page not found</h2>
        <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6 flex justify-center">
          <Link to="/">
            <Button variant="primary" className="font-bold">
              Return Home
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

export function DefaultErrorComponent({ error, reset }: { error: Error; reset?: () => void }) {
  const router = useRouter();
  return (
    <div className="min-h-[100dvh] flex items-center justify-center p-6 bg-[var(--surface-pink)]">
      <Card variant="default" className="max-w-md w-full p-8 text-center rounded-3xl shadow-lg border border-[var(--border)]">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--error-soft)] text-[var(--error-text)] flex items-center justify-center">
          <AppIcon name="close" size={32} />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--ink)]">Something went wrong</h1>
        <p className="text-xs text-[var(--text-secondary)] mt-2 leading-relaxed">
          {error?.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Button
            variant="primary"
            onClick={() => {
              router.invalidate();
              reset?.();
            }}
          >
            Try again
          </Button>
          <Link to="/">
            <Button variant="secondary">Go home</Button>
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
  useEffect(() => {
    applyTheme(getTheme());
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
