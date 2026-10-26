/**
 * service-worker.js — Asterix / Fizz-me PWA
 */

'use strict';

const VERSION      = 'asterix-v5'; // Bumped version to force update
const SHELL_CACHE  = `${VERSION}-shell`;
const STATIC_CACHE = `${VERSION}-static`;
const API_CACHE    = `${VERSION}-api`;
const MEDIA_CACHE  = `${VERSION}-media`;

const ALL_CACHES = [SHELL_CACHE, STATIC_CACHE, API_CACHE, MEDIA_CACHE];

const SHELL_URLS = [
  '/',
  '/auth/login/',
  '/auth/signup/',
  '/static/manifest.json',
  '/static/images/icon-192.png',
  '/static/images/default_profile_picture.webp',
  '/static/sounds/notification-sound.mp3',
];

const CDN_HOSTS   = ['cdnjs.cloudflare.com', 'use.fontawesome.com'];
const MEDIA_HOSTS = ['res.cloudinary.com', 'cloudinary.com'];

// ── Lifecycle ────────────────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_URLS).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k.startsWith('asterix-') && !ALL_CACHES.includes(k))
            .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch routing ────────────────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;

  // Only handle GET
  if (request.method !== 'GET') return;

  const url         = new URL(request.url);
  const sameOrigin  = url.origin === self.location.origin;
  const isCDN       = CDN_HOSTS.some(h => url.hostname.includes(h));
  const isMedia     = MEDIA_HOSTS.some(h => url.hostname.includes(h));

  // 👇 NEW: Handle page navigations to prevent the offline Dino 👇
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // If network fails, serve the cached app shell
        return caches.match('/') || caches.match('/auth/login/') || caches.match(request);
      })
    );
    return;
  }

  if (!sameOrigin && !isCDN && !isMedia) return;

  if (sameOrigin && url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirst(request, API_CACHE, 8_000));
    return;
  }
  if (sameOrigin && (url.pathname.startsWith('/static/js/') || url.pathname.startsWith('/static/css/') || url.pathname === '/static/manifest.json')) {
    event.respondWith(networkFirst(request, STATIC_CACHE, 5_000));
    return;
  }
  if ((sameOrigin && (url.pathname.startsWith('/static/images/') || url.pathname.startsWith('/static/fonts/'))) || isCDN) {
    event.respondWith(cacheFirst(request, SHELL_CACHE));
    return;
  }
  if (sameOrigin && (url.pathname.startsWith('/media/') || url.pathname.startsWith('/static/sounds/'))) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE));
    return;
  }
  if (isMedia) {
    event.respondWith(staleWhileRevalidate(request, MEDIA_CACHE));
    return;
  }
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

// ── Caching strategies ───────────────────────────────────────────────────────
async function cacheFirst(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch { return offlineFallback(request); }
}

async function networkFirst(request, cacheName, timeoutMs = 8_000) {
  const cache      = await caches.open(cacheName);
  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  } catch {
    clearTimeout(timer);
    const cached = await cache.match(request);
    return cached || offlineFallback(request);
  }
}

async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);
  const revalidate = fetch(request).then(response => {
    if (isCacheable(response)) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  return cached || revalidate || offlineFallback(request);
}

function isCacheable(response) {
  if (!response) return false;
  if (response.type === 'opaque') return true;
  if (response.status === 206) return false;
  return response.ok;
}

function offlineFallback(request) {
  const accept = request.headers.get('Accept') || '';
  if (accept.includes('text/html')) {
    return caches.match('/') || new Response('<h2>You are offline</h2>', { headers: { 'Content-Type': 'text/html' } });
  }
  return new Response('', { status: 503, statusText: 'Service Unavailable' });
}

// ── Push Notifications ───────────────────────────────────────────────────────
self.addEventListener('push', event => {
  const defaults = {
    title: 'Fizz-me',
    body:  'You have a new message',
    icon:  '/static/images/icon-192.png',
    badge: '/static/images/icon-192.png',
    tag:   'Fizz-me-msg',
    url:   '/',
  };

  let data = { ...defaults };
  try { Object.assign(data, event.data?.json()); } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon,
      badge: data.badge,
      tag: data.tag,
      data: { url: data.url },
      vibrate: [200, 100, 200],
      requireInteraction: true,
      silent: false,
      actions: [{ action: 'open', title: 'Open' }, { action: 'dismiss', title: 'Dismiss' }],
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const target = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes(self.location.origin));
      if (existing) {
        existing.focus();
        existing.postMessage({ type: 'NAVIGATE', url: target });
      } else {
        clients.openWindow(target);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(subscription => {
        return fetch('/api/push/subscribe/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(subscription.toJSON())
        });
      })
  );
});

// ── Background sync ──────────────────────────────────────────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-messages') {
    event.waitUntil(flushOutbox());
  }
});

async function flushOutbox() {
  let db;
  try { db = await openIDB(); } catch { return; }

  const items = await idbGetAll(db, 'outbox');

  for (const item of items) {
    try {
      const fd = new FormData();
      Object.entries(item).forEach(([k, v]) => fd.append(k, v));

      const response = await fetch('/api/messages/send/', {
        method:      'POST',
        body:        fd,
        credentials: 'include',
      });

      if (response.ok) {
        const tx = db.transaction('outbox', 'readwrite');
        tx.objectStore('outbox').delete(item.id);
        await txDone(tx);
      }
    } catch {
      // Leave the item in the outbox — next sync will retry.
    }
  }
}

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('Fizz-me', 1);
    req.onupgradeneeded = e => {
      e.target.result.createObjectStore('outbox', {
        keyPath:       'id',
        autoIncrement: true,
      });
    };
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function idbGetAll(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = resolve;
    tx.onerror    = e => reject(e.target.error);
    tx.onabort    = e => reject(e.target.error);
  });
}