import { Outlet, Link, createRootRoute, useRouter } from "@tanstack/react-router";
import { AuthProvider } from "@/providers/auth";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { applyTheme, getTheme } from "@/lib/theme";
import { SmileySad } from "@phosphor-icons/react";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function DefaultErrorComponent({ error }: { error: Error }) {
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center flex flex-col items-center">
        <div className="mb-4 text-primary">
          <SmileySad weight="duotone" className="w-16 h-16" />
        </div>
        <h1 className="text-2xl font-bold text-foreground">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {error?.message || "An unexpected error occurred. Please try again."}
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <button
            onClick={() => router.invalidate()}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </Link>
        </div>
      </div>
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
