/**
 * Service worker mínimo y auditable de Casa Brasa.
 *
 * Estrategias:
 * - Navegaciones: network-first con fallback a caché y luego a /offline.
 * - Imágenes generadas del menú e iconos: cache-first (contenido inmutable
 *   por slug; al regenerar cambia la URL solo si cambia el slug).
 * - Estáticos de Next (_next/static): cache-first (hash en la URL).
 * - NUNCA se cachean: /api/, /checkout, /admin, /pedido (datos sensibles
 *   o dinámicos; los precios confirmados no se sirven desde caché).
 */
const VERSION = "v1";
const SHELL_CACHE = `shell-${VERSION}`;
const RUNTIME_CACHE = `runtime-${VERSION}`;
const OFFLINE_URL = "/offline";

const NEVER_CACHE = ["/api/", "/checkout", "/admin", "/pedido"];

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
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function shouldNeverCache(url) {
  return NEVER_CACHE.some((prefix) => url.pathname.startsWith(prefix));
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (shouldNeverCache(url)) return;

  // Navegaciones de página: red primero, caché después, /offline al final.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
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

  // Recursos inmutables: caché primero.
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
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
