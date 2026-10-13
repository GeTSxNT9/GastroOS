/* GastroOS · Service Worker: app-shell offline + cache-first para recursos estáticos. */
'use strict';

const CACHE_PREFIX = 'gastroos-';
const CACHE_NAME = 'gastroos-v53';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './recipes.json',
  './css/gastroos.css',
  './js/gastroos.js',
  './js/kitchen-rules.js', './js/stock-utils.js', './js/shopping-engine.js', './js/menu-generation-engine.js', './js/menu-selection-rules.js', './js/menu-structure-validator.js', './js/menu-frequency-rules.js', './js/menu-continuity-rules.js', './js/menu-daily-rules.js',
  './js/github-network.js',
  './js/data-store-facade.js',
  './js/menu-engine-facade.js',
  './js/github-facade.js',
  './favicon-32.png',
  './apple-touch-icon.png',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com'
];
const CORE = ['./index.html', './js/github-network.js', './css/gastroos.css', './js/gastroos.js', './js/kitchen-rules.js', './js/stock-utils.js', './js/shopping-engine.js', './js/menu-generation-engine.js', './js/menu-selection-rules.js', './js/menu-structure-validator.js', './js/menu-frequency-rules.js', './js/menu-continuity-rules.js', './js/menu-daily-rules.js', './js/data-store-facade.js'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    try {
      const cache = await caches.open(CACHE_NAME);
      // Los recursos esenciales deben estar disponibles para poder afirmar que el shell está instalado.
      await Promise.all(CORE.map(async path => {
        const response = await fetch(path, { cache: 'reload' });
        if (!response.ok || response.type === 'opaque') throw new Error(`No se pudo precargar ${path}`);
        await cache.put(path, response);
      }));
      // Recursos secundarios (incluida la CDN de Tailwind) no deben bloquear la instalación.
      await Promise.all(APP_SHELL.filter(path => !CORE.includes(path)).map(async path => {
        try {
          const externalTailwind = path === 'https://cdn.tailwindcss.com';
          const response = await fetch(path, externalTailwind ? { cache: 'reload', mode: 'no-cors' } : { cache: 'reload' });
          if (externalTailwind ? response.type === 'opaque' : response.ok && response.type === 'basic') await cache.put(path, response);
        } catch (_) { /* Recurso opcional: no bloquea la instalación. */ }
      }));
      await self.skipWaiting();
    } catch (error) {
      // No dejar una caché parcial como si la instalación hubiera sido correcta.
      try { await caches.delete(CACHE_NAME); } catch (_) { /* Mantener el error original. */ }
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const isTailwindCdn = url.origin === 'https://cdn.tailwindcss.com' && url.pathname === '/';
  if (url.origin !== self.location.origin && !isTailwindCdn) return;

  // Dependencia de estilos usada por index.html: cache-first para que la app
  // no pierda el diseño cuando la red desaparezca tras la primera carga.
  if (isTailwindCdn) {
    event.respondWith((async () => {
      const cached = await caches.match('https://cdn.tailwindcss.com');
      if (cached) {
        event.waitUntil((async () => { try { const fresh = await fetch(request); if (fresh.ok || fresh.type === 'opaque') (await caches.open(CACHE_NAME)).put('https://cdn.tailwindcss.com', fresh); } catch (_) {} })());
        return cached;
      }
      try { const response = await fetch(request); if (response.ok || response.type === 'opaque') (await caches.open(CACHE_NAME)).put('https://cdn.tailwindcss.com', response.clone()); return response; }
      catch (_) { return Response.error(); }
    })());
    return;
  }

  // Navegación: intenta actualizar; si no hay red, sirve la shell cacheada.
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', response.clone());
          return response;
        }
        // Un 404/500 del servidor también debe permitir abrir el shell offline.
        return (await caches.match(request)) || (await caches.match('./index.html')) || response;
      } catch (_) {
        return (await caches.match(request)) || (await caches.match('./index.html')) || Response.error();
      }
    })());
    return;
  }

  // Recursos de la misma app: caché primero para que los assets funcionen offline.
  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) {
      event.waitUntil((async () => {
        try {
          const fresh = await fetch(request);
          if (fresh.ok && fresh.type === 'basic') (await caches.open(CACHE_NAME)).put(request, fresh);
        } catch (_) {}
      })());
      return cached;
    }
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        (await caches.open(CACHE_NAME)).put(request, response.clone());
        return response;
      }
      return (await caches.match(request)) || response;
    } catch (_) {
      return (await caches.match(request)) || Response.error();
    }
  })());
});
