import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppIcon } from "@/components/ui/app-icon";
import { Button } from "@/components/ui/button";
import { sfx } from "@/lib/sounds";
import {
  getPublicVapidKey,
  isIosNeedsHomeScreen,
  isPushSupported,
  subscribeBrowserPush,
  unsubscribeBrowserPush,
} from "@/lib/push";
import {
  edgeKidGetPushStatus,
  edgeKidRemovePushSubscription,
  edgeKidSavePushSubscription,
  edgeParentGetPushStatus,
  edgeParentRemovePushSubscription,
  edgeParentSavePushSubscription,
} from "@/lib/edge";

interface PushNotificationCardProps {
  role: "parent" | "kid";
  kidCode?: string;
}

export function PushNotificationCard({ role, kidCode }: PushNotificationCardProps) {
  const [count, setCount] = useState(0);
  const [serverConfigured, setServerConfigured] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported = isPushSupported();
  const iosNeedsInstall = isIosNeedsHomeScreen();
  const clientVapidReady = Boolean(getPublicVapidKey());

  const loadStatus = async () => {
    try {
      const res =
        role === "parent"
          ? await edgeParentGetPushStatus()
          : kidCode
            ? await edgeKidGetPushStatus({ code: kidCode })
            : { count: 0, configured: false };
      setCount(res.count);
      setServerConfigured(res.configured);
    } catch {
      // keep silent if offline or unauthenticated
    }
  };

  useEffect(() => {
    void loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role, kidCode]);

  const enablePush = async () => {
    setBusy(true);
    try {
      const subscription = await subscribeBrowserPush();
      if (role === "parent") {
        await edgeParentSavePushSubscription({
          subscription,
          userAgent: navigator.userAgent,
        });
      } else if (kidCode) {
        await edgeKidSavePushSubscription({
          code: kidCode,
          subscription,
          userAgent: navigator.userAgent,
        });
      }
      sfx.success();
      toast.success("Push notifications enabled on this device");
      await loadStatus();
    } catch (err) {
      sfx.error();
      toast.error(err instanceof Error ? err.message : "Could not enable notifications");
    } finally {
      setBusy(false);
    }
  };

  const disablePush = async () => {
    setBusy(true);
    try {
      const endpoint = await unsubscribeBrowserPush();
      if (role === "parent") {
        await edgeParentRemovePushSubscription({ endpoint });
      } else if (kidCode) {
        await edgeKidRemovePushSubscription({ code: kidCode, endpoint });
      }
      sfx.tap();
      toast.success("Push notifications turned off");
      await loadStatus();
    } catch (err) {
      sfx.error();
      toast.error(err instanceof Error ? err.message : "Could not turn off notifications");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 text-[var(--action)]">
          <AppIcon name="bell" size={18} />
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="m-0 text-sm font-semibold text-[var(--ink)]">
            Request and approval alerts
          </p>
          <p className="m-0 text-xs text-[var(--text-2)] leading-relaxed">
            {count > 0
              ? `Active on ${count} ${count === 1 ? "device" : "devices"}.`
              : "Get notified when a request is sent or resolved."}
          </p>
        </div>
      </div>

      {iosNeedsInstall && (
        <p className="m-0 rounded-xl bg-[var(--action-tint)] px-3 py-2 text-xs text-[var(--ink)] leading-relaxed">
          On iPhone or iPad, add Centsibility to your Home Screen first (tap Share, then Add to Home Screen), and open it from your Home Screen to enable push alerts.
        </p>
      )}

      {!supported && !iosNeedsInstall && (
        <p className="m-0 text-xs text-[var(--text-muted)]">
          This browser does not support Web Push notifications.
        </p>
      )}

      {supported && (!clientVapidReady || !serverConfigured) && (
        <p className="m-0 text-xs text-[var(--text-muted)]">
          Push alerts will activate once the server VAPID key is configured.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="primary"
          disabled={busy || !supported || iosNeedsInstall || !clientVapidReady}
          onClick={enablePush}
        >
          {busy ? "Working…" : "Enable push alerts"}
        </Button>
        {count > 0 && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={busy}
            onClick={disablePush}
          >
            Turn off
          </Button>
        )}
      </div>
    </div>
  );
}
