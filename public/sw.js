/**
 * Service Worker para UNAM Immersive Experience - PC PUMA.
 * Habilita el funcionamiento 100% offline y en condiciones de conectividad nula o deficiente en eventos.
 */

const CACHE_NAME = 'unam-xr-v2';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/branding/pcpuma-logo.png',
  './assets/pcpuma-logo.png',
  './assets/main.js',
  './assets/GLTFLoader.js',
  './operador/index.html',
  './operador.html',
];

// Instalación: Precargar recursos esenciales del shell de la aplicación
self.addEventListener('install', (event) => {
  console.info('[SW] Instalando Service Worker y precargando recursos base...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        PRECACHE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] No se pudo precachear ${url} durante la instalación:`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Activación: Limpieza de versiones obsoletas de caché
self.addEventListener('activate', (event) => {
  console.info('[SW] Activando Service Worker...');
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.info(`[SW] Eliminando caché antiguo: ${key}`);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Intercepción de peticiones de red
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // No interceptar peticiones no GET o de extensiones
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Las peticiones Range de video las gestiona IndexedDB (OfflineStorageManager)
  // o se delegan directamente a la red si no están en local para evitar errores 206 en Safari/Quest
  if (request.headers.get('range') || url.pathname.endsWith('.mp4')) {
    return;
  }

  // Estrategia: Cache-First con Network Fallback para modelos 3D y scripts JS
  if (
    url.pathname.endsWith('.glb') ||
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.webmanifest')
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => {
            // Si no hay red y no está en caché, devolver respuesta vacía
            return new Response(null, { status: 504, statusText: 'Offline' });
          });
      })
    );
    return;
  }

  // Navegación (HTML): Network-First con fallback a index.html en caché
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return caches.match('./index.html').then((indexFallback) => {
              return indexFallback || new Response('Modo Offline Activo', {
                status: 200,
                headers: { 'Content-Type': 'text/html; charset=utf-8' },
              });
            });
          });
        })
    );
    return;
  }

  // Demás peticiones: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
