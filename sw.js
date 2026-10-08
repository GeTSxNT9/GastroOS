/* GastroOS · Service Worker · Fase definitiva · oferta configurable + compra manual + carga inicial
 * Caché versionada y actualizaciones seguras.
 * La aplicación sigue usando estrategia network-first: intenta obtener la versión
 * más reciente y recurre a la caché si no hay conexión.
 */
'use strict';

const CACHE_PREFIX = 'gastroos-';
const CACHE_NAME = 'gastroos-v8';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './recipes.json',
  './css/gastroos.css',
  './js/gastroos.js',
  './js/kitchen-rules.js',
  './js/data-store-facade.js',
  './js/menu-engine-facade.js',
  './js/github-facade.js',
  './favicon-32.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Los recursos principales se precargan individualmente para que un icono
    // opcional ausente no impida instalar toda la aplicación.
    await Promise.all(APP_SHELL.map(async path => {
      try {
        const response = await fetch(path, { cache: 'reload' });
        if (response && response.status === 200 && response.type === 'basic') {
          await cache.put(path, response);
        }
      } catch (_) {
        // Si no se puede descargar un recurso ahora, la instalación continúa.
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response && response.status === 200 && response.type === 'basic') {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    } catch (_) {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === 'navigate') {
        const appShell = await caches.match('./index.html');
        if (appShell) return appShell;
      }
      return Response.error();
    }
  })());
});
