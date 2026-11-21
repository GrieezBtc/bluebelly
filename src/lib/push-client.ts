"use client";

import { api } from "@/lib/client";

export function pushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function registration() {
  const existing = await navigator.serviceWorker.getRegistration("/");
  if (existing) return navigator.serviceWorker.ready;
  await navigator.serviceWorker.register("/sw.js");
  return navigator.serviceWorker.ready;
}

export async function currentSubscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration("/");
  return reg ? reg.pushManager.getSubscription() : null;
}

/** Ask permission, subscribe this device, and register it with the server. */
export async function enablePushOnDevice(): Promise<{ ok: true } | { ok: false; reason: "unsupported" | "denied" | "not_configured" | "error"; message?: string }> {
  if (!pushSupported()) return { ok: false, reason: "unsupported" };
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" };
  try {
    const { publicKey } = await api.get<{ publicKey: string | null }>("/api/push");
    if (!publicKey) return { ok: false, reason: "not_configured" };
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    await api.post("/api/push", { subscription: sub.toJSON() });
    return { ok: true };
  } catch (error) {
    return { ok: false, reason: "error", message: error instanceof Error ? error.message : undefined };
  }
}

/**
 * Keep this device's subscription registered. Installing BlueBelly to the home screen (or clearing site data)
 * can leave the server holding an old endpoint, so on every launch we make sure the current one is saved.
 * Never asks for permission: it only acts when notifications are already allowed.
 */
export async function resyncPushSubscription() {
  try {
    if (!pushSupported() || Notification.permission !== "granted") return;
    const { publicKey } = await api.get<{ publicKey: string | null }>("/api/push");
    if (!publicKey) return;
    const reg = await registration();
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) }));
    await api.post("/api/push", { subscription: sub.toJSON() });
  } catch {
    /* best effort: the next launch tries again */
  }
}

export async function disablePushOnDevice() {
  const sub = await currentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe().catch(() => undefined);
  await fetch("/api/push", {
    method: "DELETE",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ endpoint }),
    credentials: "same-origin",
  }).catch(() => undefined);
}
