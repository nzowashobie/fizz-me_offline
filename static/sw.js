// Service Worker for Asterix PWA
const CACHE_NAME = 'asterix-v1';
const STATIC_ASSETS = [
    '/',
    '/static/css/base.css',
    '/static/css/sidebar.css',
    '/static/css/chat.css',
    '/static/css/modals.css',
    '/static/css/status.css',
    '/static/js/utils.js',
    '/static/js/auth.js',
    '/static/js/chat.js',
    '/static/js/sidebar.js',
    '/static/js/modals.js',
    '/static/js/status.js',
    '/static/js/app.js',
    '/static/images/icon-192.png',
    '/static/images/icon-512.png',
    '/static/manifest.json'
];

// Install event - cache static assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching static assets...');
                return cache.addAll(STATIC_ASSETS);
            })
            .then(() => self.skipWaiting())
    );
});

// Activate event - clean old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.filter(name => name !== CACHE_NAME)
                    .map(name => caches.delete(name))
            );
        })
        .then(() => self.clients.claim())
    );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
    // Skip cross-origin requests
    if (!event.request.url.startsWith(self.location.origin)) {
        return;
    }

    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }

    event.respondWith(
        caches.match(event.request)
            .then(cachedResponse => {
                // Return cached response if found
                if (cachedResponse) {
                    return cachedResponse;
                }

                // Otherwise fetch from network
                return fetch(event.request)
                    .then(response => {
                        // Cache successful responses
                        if (response.status === 200) {
                            const clonedResponse = response.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, clonedResponse);
                                });
                        }
                        return response;
                    })
                    .catch(() => {
                        // Offline fallback
                        if (event.request.headers.get('accept').includes('text/html')) {
                            return caches.match('/');
                        }
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// Push notification handler
self.addEventListener('push', event => {
    const data = event.data.json();
    const options = {
        body: data.body || 'New message',
        icon: '/static/images/icon-192.png',
        badge: '/static/images/icon-192.png',
        vibrate: [200, 100, 200],
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title || 'Asterix', options)
    );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
    event.notification.close();

    const url = event.notification.data?.url || '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' })
            .then(windowClients => {
                // Check if there's already a window/tab open
                for (let client of windowClients) {
                    if (client.url === url && 'focus' in client) {
                        return client.focus();
                    }
                }
                // If not, open a new window
                if (clients.openWindow) {
                    return clients.openWindow(url);
                }
            })
    );
});
