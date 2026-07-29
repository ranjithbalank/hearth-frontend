/* Hearth service worker — makes the app installable (a standalone desktop /
 * mobile window) and keeps the shell working on a flaky connection.
 *
 * Deliberately conservative: it only ever caches same-origin GET requests for
 * static assets. It NEVER touches /api (live data + auth must stay fresh) and
 * NEVER caches non-GET requests (no swallowing of writes). Cache-first for
 * assets with a background refresh; network-first (cache fallback) for page
 * navigations so a reload offline still opens the app. */
const CACHE = "hearth-shell-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin GETs; API and writes always go straight to the network.
  if (req.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api")) return;

  // SPA navigations: try network first so content is fresh, fall back to the
  // cached shell (index.html) when offline.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(req).then((c) => c || caches.match("/")))
    );
    return;
  }

  // Static assets (hashed JS/CSS/fonts/images): cache-first, refresh in the
  // background so the next load is current.
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
