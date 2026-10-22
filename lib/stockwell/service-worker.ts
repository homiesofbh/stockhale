export const developmentWorker = `self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("stockwell-offline-")).map((key) => caches.delete(key)));
    await self.registration.unregister();
    await self.clients.claim();
  })());
});
// No fetch handler: development HTML and chunks always use the network.
`;

export const productionWorker = `const CACHE = "stockwell-offline-v6";
self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    const routes = ["/", "/sign-in", "/sign-up", "/team-sign-up"];
    await cache.addAll([...routes, "/fonts/stockwell-unicode.ttf"]);
    // The first page's scripts loaded before this worker took control.
    // Warm them and CSS dependencies so the very next reload works offline.
    const assets = new Set();
    for (const route of routes) {
      const response = await cache.match(route);
      const html = await response.text();
      for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
        const url = new URL(match[1].replace(/&amp;/g, "&"), location.origin);
        if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) assets.add(url.href);
      }
    }
    await cache.addAll([...assets]);
    for (const asset of assets) {
      if (!new URL(asset).pathname.endsWith(".css")) continue;
      const css = await (await cache.match(asset)).text();
      const dependencies = [];
      for (const match of css.matchAll(/url\\((?:["'])?([^\\)"']+)(?:["'])?\\)/g)) {
        const url = new URL(match[1], asset);
        if (url.origin === location.origin && url.pathname.startsWith("/_next/static/")) dependencies.push(url.href);
      }
      await cache.addAll(dependencies);
    }
  })());
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("stockwell-offline-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      ),
  );
  self.clients.claim();
});
self.addEventListener("fetch", (event) => {
  const req = event.request,
    url = new URL(req.url);
  if (
    req.method !== "GET" ||
    url.origin !== location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
          }
          return res;
        })
        .catch(() => caches.match(req).then((res) => res || caches.match("/"))),
    );
  } else if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/fonts/")
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              event.waitUntil(caches.open(CACHE).then((c) => c.put(req, copy)));
            }
            return res;
          }),
      ),
    );
  }
});
`;
