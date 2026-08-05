/**
 * Service worker auditable: solo conserva navegaciones pÃºblicas en cachÃ©.
 */
const VERSION = "v4";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const OFFLINE_URL = "/offline";

const PUBLIC_NAVIGATION_PREFIXES = [
  "/",
  "/menu",
  "/buscar",
  "/promociones",
  "/sucursales",
  "/nosotros",
  "/contacto",
  "/preguntas-frecuentes",
  "/alergenos",
  "/privacidad",
  "/terminos",
  "/cookies",
  "/offline",
];

const PRIVATE_PREFIXES = [
  "/auth",
  "/cuenta",
  "/login",
  "/registro",
  "/recuperar-contrasena",
  "/actualizar-contrasena",
  "/admin",
  "/empleado",
  "/pensionado",
  "/api",
  "/checkout",
  "/pedido",
];

function hasPrefix(pathname, prefix) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

function isPublicNavigation(url) {
  if (url.origin !== self.location.origin) return false;
  if (PRIVATE_PREFIXES.some((prefix) => hasPrefix(url.pathname, prefix))) return false;
  return PUBLIC_NAVIGATION_PREFIXES.some((prefix) => hasPrefix(url.pathname, prefix));
}

function isCacheableResponse(response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  if (response.redirected) {
    try {
      if (!isPublicNavigation(new URL(response.url))) return false;
    } catch {
      return false;
    }
  }
  const cacheControl = response.headers.get("cache-control") || "";
  if (response.headers.has("set-cookie")) return false;
  if (/(^|[,\s])(?:private|no-store)(?:[,\s]|$)/i.test(cacheControl)) return false;
  return true;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then(async (names) => {
      await Promise.all(
        names
          .filter((name) => /^(?:shell|runtime)-/.test(name) && ![SHELL_CACHE, RUNTIME_CACHE].includes(name))
          .map((name) => caches.delete(name)),
      );
      for (const name of [SHELL_CACHE, RUNTIME_CACHE]) {
        const cache = await caches.open(name);
        const requests = await cache.keys();
        await Promise.all(
          requests.map(async (request) => {
            try {
              const url = new URL(request.url);
              const response = await cache.match(request);
              if (!isPublicNavigation(url) || !isCacheableResponse(response)) await cache.delete(request);
            } catch {
              await cache.delete(request);
            }
          }),
        );
      }
      await self.clients.claim();
    }),
  );
});

function isImmutableResponse(response) {
  if (!response || !response.ok || response.type !== "basic") return false;
  const cacheControl = response.headers.get("cache-control") || "";
  return /(?:^|,|\s)immutable(?:\s|,|$)/i.test(cacheControl) && !/no-store|no-cache|private/i.test(cacheControl);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    if (!isPublicNavigation(url)) return;
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const finalUrl = new URL(response.url || request.url);
          if (isPublicNavigation(finalUrl) && isCacheableResponse(response)) {
            const copy = response.clone();
            const cache = await caches.open(RUNTIME_CACHE);
            await cache.put(request, copy);
          }
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL))
            .then((fallback) => fallback || Response.error()),
        ),
    );
    return;
  }

  const isImmutable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/generated/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/_next/image");

  if (isImmutable) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then(async (response) => {
            if (isImmutableResponse(response)) {
              const copy = response.clone();
              const cache = await caches.open(RUNTIME_CACHE);
              await cache.put(request, copy);
            }
            return response;
          }),
      ),
    );
  }
});
