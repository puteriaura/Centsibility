import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { getKidSession } from "@/lib/kid-session";
import { useAuth } from "@/providers/auth";

export const Route = createFileRoute("/launch")({ component: Launch });

function Launch() {
  const { session, loading } = useAuth();
  if (getKidSession()) return <Navigate to="/kid" replace />;
  if (loading) return <p role="status">Opening Centsibility…</p>;
  if (session) return <Navigate to="/parent" replace />;

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-4 p-6">
      <h1 className="text-2xl font-bold">Welcome to Centsibility</h1>
      <Link className="rounded-xl bg-[var(--brand-card)] p-4 text-[var(--on-brand-card)]" to="/login">I'm a parent</Link>
      <Link className="rounded-xl bg-[var(--surface)] p-4 text-[var(--ink)]" to="/kid-login">I'm a young saver</Link>
    </main>
  );
}
