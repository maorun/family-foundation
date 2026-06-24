const CACHE_NAME = "family-foundation-v1";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/logo.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-icon-180.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }

          return response;
        })
        .catch(async () => (await caches.match(request)) || caches.match("/")),
    );

    return;
  }

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") || CORE_ASSETS.includes(url.pathname);

  event.respondWith(
    (isStaticAsset ? caches.match(request) : Promise.resolve(undefined))
      .then(
        (cachedResponse) =>
          cachedResponse ||
          fetch(request).then((response) => {
            if (response.ok) {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }

            return response;
          }),
      )
      .catch(() => caches.match(request)),
  );
});
