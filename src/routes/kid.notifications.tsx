import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AppIcon } from "@/components/ui/app-icon";
import { useKidData } from "@/hooks/use-kid-data";
import { KidLoadError } from "@/features/kid/components";
import { edgeKidMarkNotificationsRead } from "@/lib/edge";
import { getKidSession } from "@/lib/kid-session";
import { sanitizeDisplayText } from "@/lib/labels";
import { formatDate } from "@/lib/format";
import { sfx } from "@/lib/sounds";

import { usePrivacy, maskAmounts } from "@/features/privacy";

export const Route = createFileRoute("/kid/notifications")({
  head: () => ({ meta: [{ title: "Notifications | Centsibility" }] }),
  component: KidNotifications,
});

function formatTimeAgo(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(date);
}

function getNotificationIcon(kind: string): string {
  const k = kind.toUpperCase();
  if (k.includes("SADAQAH")) return "sadaqah";
  if (k.includes("TRANSFER")) return "wallet";
  if (k.includes("REWARD")) return "gift";
  if (k.includes("LOAN") || k.includes("QARD")) return "loan";
  if (k.includes("GOAL") || k.includes("TABUNG")) return "save";
  if (k.includes("DEPOSIT")) return "incoming";
  if (k.includes("WITHDRAW")) return "outgoing";
  if (k.includes("HIBAH")) return "gift";
  if (k.includes("CHORE")) return "gift";
  if (k.includes("INVEST")) return "trend";
  return "bell";
}

function KidNotifications() {
  const { data, loading, error, refresh } = useKidData();
  const { locked } = usePrivacy();

  useEffect(() => {
    const code = getKidSession()?.code;
    if (!code) return;
    return () => {
      edgeKidMarkNotificationsRead({ code })
        .then(() => {
          window.dispatchEvent(new Event("centsibility:kid-notifications-read"));
        })
        .catch(() => {});
    };
  }, []);

  if (!data && error) return <KidLoadError onRetry={refresh} />;
  if (loading || !data) {
    return (
      <div className="space-y-3 pb-8">
        <Skeleton style={{ height: "4.5rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "4.5rem", borderRadius: "16px" }} />
        <Skeleton style={{ height: "4.5rem", borderRadius: "16px" }} />
      </div>
    );
  }

  const notifications = data.notifications ?? [];

  return (
    <div className="space-y-4 pb-12">
      {notifications.length === 0 ? (
        <Card variant="soft" className="p-8 text-center space-y-3 m-0">
          <div className="w-14 h-14 rounded-2xl bg-[var(--surface-soft)] text-[var(--text-muted)] flex items-center justify-center mx-auto">
            <AppIcon name="bell" size={28} />
          </div>
          <h2 className="text-base font-bold text-[var(--ink)] m-0">
            No notifications yet.
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto m-0">
            Activity updates, sadaqah confirmations, and messages from your parent will appear here.
          </p>
        </Card>
      ) : (
        <div className="space-y-2.5" aria-label="Notifications list">
          {notifications.map((n) => {
            const iconName = getNotificationIcon(n.kind);
            const timeStr = formatTimeAgo(n.created_at);
            const cleanMessage = maskAmounts(sanitizeDisplayText(n.message), locked);

            const content = (
              <div className="flex items-start gap-3 p-3.5">
                <div className="w-9 h-9 rounded-xl bg-[var(--surface-soft)] text-[var(--primary-text)] flex items-center justify-center shrink-0 mt-0.5">
                  <AppIcon name={iconName} size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-[var(--text-muted)]">
                      {timeStr}
                    </span>
                    {!n.read && (
                      <span
                        className="w-2 h-2 rounded-full bg-[var(--primary)] shrink-0"
                        aria-label="Unread"
                      />
                    )}
                  </div>
                  <p className="text-xs font-semibold text-[var(--ink)] leading-snug mt-1 mb-0">
                    {cleanMessage}
                  </p>
                </div>
                {n.link && (
                  <AppIcon name="forward" size={18} className="shrink-0 self-center text-[var(--text-3)]" />
                )}
              </div>
            );

            if (n.link) {
              return (
                <Card
                  key={n.id}
                  variant="default"
                  className="p-0 border border-[var(--border)] overflow-hidden transition-colors hover:border-[var(--primary-soft)] hover:shadow-xs active:scale-[0.99]"
                >
                  <Link
                    to={n.link}
                    onClick={() => sfx.tap()}
                    className="block text-inherit no-underline"
                  >
                    {content}
                  </Link>
                </Card>
              );
            }

            return (
              <Card
                key={n.id}
                variant="default"
                className="p-0 border border-[var(--border)] overflow-hidden"
              >
                {content}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
