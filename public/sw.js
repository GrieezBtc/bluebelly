/* BlueBelly service worker — offline shell + fast repeat loads.
   Data requests always go to the network first: privacy rules and message
   expiration are enforced server-side and must never be served from cache. */
const VERSION = "bluebelly-v2";
const SHELL_CACHE = `${VERSION}-shell`;
const MEDIA_CACHE = `${VERSION}-media`;
const OFFLINE_URL = "/offline";

const SHELL_ASSETS = ["/", "/offline", "/manifest.webmanifest", "/icons/bemblo-icon.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(new Request(asset, { cache: "reload" }))));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "bemblo:skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API traffic (auth, privacy, expiry, media).
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request).catch(() =>
        new Response(JSON.stringify({ ok: false, error: { code: "offline", message: "You are offline." } }), {
          status: 503,
          headers: { "content-type": "application/json" },
        }),
      ),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          const offline = await cache.match(OFFLINE_URL);
          return offline ?? new Response("Offline", { status: 503, headers: { "content-type": "text/plain" } });
        }
      })(),
    );
    return;
  }

  if (/\.(png|jpg|jpeg|webp|svg|woff2?|css|js|mp4)$/.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(MEDIA_CACHE);
        const cached = await cache.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response.ok && response.type === "basic") cache.put(request, response.clone());
          return response;
        } catch {
          return cached ?? Response.error();
        }
      })(),
    );
  }
});

self.addEventListener("push", (event) => {
  let payload = { title: "BlueBelly", body: "You have new activity.", url: "/notifications" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    /* keep defaults */
  }
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // The in-app badges already update while BlueBelly is open and focused, so skip the pop-up.
      const focused = windows.some((w) => w.focused && w.visibilityState === "visible");
      // A test from Settings must always pop up, so the person can see that delivery works.
      if (focused && payload.tag !== "bemblo-test") {
        windows.forEach((w) => w.postMessage({ type: "bemblo:push", payload }));
        return;
      }
      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: "/icons/bemblo-icon.png",
        badge: "/icons/bemblo-badge.png",
        data: { url: payload.url },
        tag: payload.tag ?? "bemblo",
        renotify: true,
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/home";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(target);
          return client.focus();
        }
      }
      return self.clients.openWindow(target);
    }),
  );
});
