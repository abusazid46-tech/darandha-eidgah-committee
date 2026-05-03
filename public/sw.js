// public/sw.js
const CACHE_NAME = 'darandha-eidgah-v2';
const OFFLINE_URL = '/offline.html';

// Files to cache on install (static assets)
const urlsToCache = [
  '/',
  '/index.html',
  '/events.html',
  '/manifest.json',
  '/offline.html'
];

// Dynamic cache patterns (files that will be cached on demand)
const dynamicCachePatterns = [
  /\.css$/,
  /\.js$/,
  /\.png$/,
  /\.jpg$/,
  /\.jpeg$/,
  /\.gif$/,
  /\.webp$/,
  /\.svg$/,
  /\.woff/,
  /\.ttf/
];

// Install event - cache app shell
self.addEventListener('install', event => {
  console.log('[Service Worker] Installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Caching app shell');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating...');
  
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  
  // Skip cross-origin requests
  if (!url.origin.startsWith(self.location.origin)) {
    return;
  }
  
  // Skip API calls (don't cache)
  if (request.url.includes('/api/')) {
    return;
  }
  
  // Skip admin panel (optional - you can cache it too)
  if (request.url.includes('/admin/')) {
    return;
  }
  
  // Handle HTML pages (network first, fallback to cache)
  if (request.mode === 'navigate' || request.headers.get('Accept').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fetched page
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request)
            .then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              // If no cache, show offline page
              return caches.match(OFFLINE_URL);
            });
        })
    );
    return;
  }
  
  // Handle static assets (cache first, fallback to network)
  if (dynamicCachePatterns.some(pattern => pattern.test(url.pathname))) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(request)
            .then(response => {
              const responseClone = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseClone);
              });
              return response;
            });
        })
    );
    return;
  }
  
  // Default: network first
  event.respondWith(
    fetch(request)
      .then(response => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Background sync for pending donations
self.addEventListener('sync', event => {
  console.log('[Service Worker] Sync event triggered');
  if (event.tag === 'sync-donations') {
    event.waitUntil(syncPendingDonations());
  }
});

async function syncPendingDonations() {
  console.log('[Service Worker] Syncing pending donations');
  // You can implement offline donation sync here
}

// Push notification handler
self.addEventListener('push', event => {
  console.log('[Service Worker] Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New update from Darandha Eidgah Committee',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: {
      url: '/'
    },
    actions: [
      {
        action: 'open',
        title: 'View Details'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Darandha Eidgah Committee', options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  if (event.action === 'open') {
    const urlToOpen = event.notification.data?.url || '/';
    event.waitUntil(
      clients.openWindow(urlToOpen)
    );
  }
});
