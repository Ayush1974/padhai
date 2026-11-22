const CACHE = 'padhai-v11';
const SHELL = ['/', '/padhai-logo.webp', '/icon-192.png?v=5', '/icon-512.png', '/manifest.webmanifest'];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);
    const response = await cache.match('/');
    const html = await response.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)].map(match => match[1]);
    const manifestResponse = await fetch('/asset-manifest.json', { cache: 'no-store' });
    const manifest = manifestResponse.ok ? await manifestResponse.json() : {};
    const modules = Object.values(manifest).flatMap(entry => [entry.file, ...(entry.css || [])]).filter(Boolean).map(file => `/${file}`);
    await cache.addAll([...new Set([...assets, ...modules])]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('padhai-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  // Private API responses must never survive account changes in a shared browser cache.
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put('/', response.clone());
        return response;
      } catch { return await cache.match('/') || new Response('Padhai needs one online visit before it can work offline.', { status: 503 }); }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    } catch { return new Response('', { status: 503 }); }
  })());
});
