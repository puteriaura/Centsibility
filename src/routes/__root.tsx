import { Outlet, Link, createRootRoute, useRouter } from "@tanstack/react-router";
import { AuthProvider } from "@/providers/auth";
import { Toaster } from "@/components/ui/sonner";
import { useEffect } from "react";
import { applyTheme, getTheme } from "@/lib/theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";

function NotFoundComponent() {
  return (
    <div className="wireframe-box" style={{ maxWidth: "500px", margin: "3rem auto", textAlign: "center" }}>
      <h1>404</h1>
      <h2>Page not found</h2>
      <p>The page you're looking for doesn't exist or has been moved.</p>
      <div style={{ marginTop: "1rem" }}>
        <Link to="/">Go home</Link>
      </div>
    </div>
  );
}

export function DefaultErrorComponent({ error, reset }: { error: Error; reset?: () => void }) {
  const router = useRouter();
  return (
    <div className="wireframe-box" style={{ maxWidth: "500px", margin: "3rem auto", textAlign: "center" }}>
      <div className="wireframe-icon" style={{ fontSize: "1.5rem" }}>[icon: sad]</div>
      <h1>Something went wrong</h1>
      <p>{error?.message || "An unexpected error occurred. Please try again."}</p>
      <div className="wireframe-row" style={{ justifyContent: "center", marginTop: "1rem" }}>
        <button
          type="button"
          onClick={() => {
            router.invalidate();
            reset?.();
          }}
        >
          Try again
        </button>
        <Link to="/">Go home</Link>
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
