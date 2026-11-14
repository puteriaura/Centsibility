export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function isIosNeedsHomeScreen(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIos = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (!isIos) return false;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return !standalone;
}

export function getPublicVapidKey(): string {
  return (import.meta.env.VITE_VAPID_PUBLIC_KEY ?? "").trim();
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function subscribeBrowserPush(): Promise<PushSubscriptionJSON> {
  const vapidPublic = getPublicVapidKey();
  if (!vapidPublic) {
    throw new Error("Push notifications are waiting on server VAPID configuration.");
  }
  if (!isPushSupported()) {
    throw new Error("Push notifications are not supported in this browser.");
  }
  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }
  const reg = await registerAppServiceWorker();
  if (!reg) throw new Error("Could not register the notification service worker.");
  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublic),
    }));
  return sub.toJSON();
}

export async function unsubscribeBrowserPush(): Promise<string | undefined> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return undefined;
  const reg = await navigator.serviceWorker.getRegistration("/");
  const existing = await reg?.pushManager.getSubscription();
  if (!existing) return undefined;
  const endpoint = existing.endpoint;
  await existing.unsubscribe();
  return endpoint;
}
