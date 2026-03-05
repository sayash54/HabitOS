const CACHE_NAME = 'habitos-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './style.css',
    './css/login.css',
    './js/main.js',
    './js/habits.js',
    './js/stats.js',
    './js/ui.js',
    './js/workout.js',
    './js/nutrition.js',
    './js/notifications.js',
    './js/bg.js',
    './js/login.js',
    './js/supabase-config.js',
    './utils/storage.js',
    './manifest.json'
];

// CDN assets cached on first use
const CDN_HOSTS = [
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'cdn.jsdelivr.net'
];

// Install: cache core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: network-first for API calls, cache-first for assets
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Never cache Supabase API calls
    if (url.hostname.includes('supabase')) {
        return;
    }

    // CDN assets: cache-first (they're versioned)
    if (CDN_HOSTS.some(host => url.hostname.includes(host))) {
        event.respondWith(
            caches.match(event.request).then((cached) => {
                if (cached) return cached;
                return fetch(event.request).then((response) => {
                    if (response.ok) {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                });
            })
        );
        return;
    }

    // App assets: network-first with cache fallback
    event.respondWith(
        fetch(event.request)
            .then((response) => {
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                return caches.match(event.request);
            })
    );
});
