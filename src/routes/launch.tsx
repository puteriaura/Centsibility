import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { getKidSession } from "@/lib/kid-session";
import { useAuth } from "@/providers/auth";
import { AppIcon } from "@/components/ui/app-icon";

export const Route = createFileRoute("/launch")({
  head: () => ({ meta: [{ title: "Welcome | Centsibility" }] }),
  component: Launch,
});

function Launch() {
  const { session, loading } = useAuth();
  if (getKidSession()) return <Navigate to="/kid" replace />;
  if (loading) {
    return (
      <main className="mx-auto grid min-h-dvh max-w-sm content-center justify-items-center gap-3 p-6 text-center">
        <img src="/icons/centsibility-app.svg" alt="Centsibility" width={56} height={56} />
        <p role="status" className="text-sm font-medium text-[var(--text-2)]">Opening Centsibility…</p>
      </main>
    );
  }
  if (session) return <Navigate to="/parent" replace />;

  return (
    <main className="mx-auto grid min-h-dvh max-w-sm content-center gap-5 p-6 bg-[var(--canvas)]">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="flex items-center gap-3">
          <img src="/icons/centsibility-app.svg" alt="Centsibility" width={48} height={48} />
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--action-tint)] border border-[var(--line)]">
            <AppIcon name="penny" size={30} />
          </span>
        </div>
        <h1 className="m-0 font-display text-2xl font-extrabold text-[var(--ink)]">Welcome to Centsibility</h1>
        <p className="m-0 text-sm text-[var(--text-2)]">Choose how you want to sign in today.</p>
      </div>
      <div className="grid gap-3">
        <Link
          to="/login"
          className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--brand-card)] p-4 text-[var(--on-brand-card)] border border-[var(--blue-500)] shadow-[var(--paper-shadow)] no-underline min-h-[64px]"
        >
          <span>
            <span className="block font-display text-base font-extrabold">I&apos;m a parent</span>
            <span className="block text-xs opacity-85">Manage family wallets, approvals and schedules</span>
          </span>
          <AppIcon name="chevron" size={20} />
        </Link>
        <Link
          to="/kid-login"
          className="flex items-center justify-between gap-3 rounded-2xl bg-[var(--surface)] p-4 text-[var(--ink)] border border-[var(--line-strong)] shadow-[var(--paper-shadow)] no-underline min-h-[64px]"
        >
          <span>
            <span className="block font-display text-base font-extrabold">I&apos;m a young saver</span>
            <span className="block text-xs text-[var(--text-2)]">Open your card, goals, quests and Penny</span>
          </span>
          <AppIcon name="chevron" size={20} />
        </Link>
      </div>
    </main>
  );
}
