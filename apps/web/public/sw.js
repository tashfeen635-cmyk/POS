// Service Worker for POS PWA - Offline Support and Background Sync
const CACHE_NAME = 'pos-cache-v1';
const STATIC_CACHE = 'pos-static-v1';
const API_CACHE = 'pos-api-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
];

// API routes to cache with network-first strategy
const CACHEABLE_API_ROUTES = [
  '/api/products',
  '/api/categories',
  '/api/customers',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');

  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      console.log('[SW] Caching static assets');
      return cache.addAll(STATIC_ASSETS);
    })
  );

  // Activate immediately
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => {
            return name.startsWith('pos-') && name !== STATIC_CACHE && name !== API_CACHE;
          })
          .map((name) => {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          })
      );
    })
  );

  // Take control of all pages immediately
  self.clients.claim();
});

// Fetch event - handle requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // Skip chrome-extension and other non-http(s) requests
  if (!url.protocol.startsWith('http')) {
    return;
  }

  // Handle API requests
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(handleApiRequest(request));
    return;
  }

  // Handle static assets
  event.respondWith(handleStaticRequest(request));
});

// Network-first strategy for API requests
async function handleApiRequest(request) {
  const url = new URL(request.url);

  try {
    // Try network first
    const networkResponse = await fetch(request);

    // Cache successful GET responses for cacheable routes
    if (networkResponse.ok && isCacheableApiRoute(url.pathname)) {
      const cache = await caches.open(API_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Network failed, try cache
    console.log('[SW] Network failed, checking cache:', url.pathname);

    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('[SW] Returning cached response:', url.pathname);
      return cachedResponse;
    }

    // Return offline error response
    return new Response(
      JSON.stringify({
        success: false,
        error: { message: 'You are offline. This data is not available.' },
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

// Cache-first strategy for static assets
async function handleStaticRequest(request) {
  const cachedResponse = await caches.match(request);

  if (cachedResponse) {
    // Return cached version and update cache in background
    fetchAndCache(request);
    return cachedResponse;
  }

  // Not in cache, fetch from network
  try {
    const networkResponse = await fetch(request);

    // Cache the response
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    // Return offline page for navigation requests
    if (request.mode === 'navigate') {
      const offlinePage = await caches.match('/');
      if (offlinePage) {
        return offlinePage;
      }
    }

    throw error;
  }
}

// Background fetch and cache update
async function fetchAndCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse);
    }
  } catch {
    // Silently fail background update
  }
}

// Check if API route should be cached
function isCacheableApiRoute(pathname) {
  return CACHEABLE_API_ROUTES.some((route) => pathname.startsWith(route));
}

// Background sync for offline sales
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);

  if (event.tag === 'sync-sales') {
    event.waitUntil(syncSales());
  }
});

// Sync pending sales
async function syncSales() {
  console.log('[SW] Syncing pending sales...');

  // Notify all clients to perform sync
  const clients = await self.clients.matchAll();
  clients.forEach((client) => {
    client.postMessage({
      type: 'SYNC_REQUIRED',
      payload: { reason: 'background-sync' },
    });
  });
}

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');

  let data = { title: 'POS Notification', body: 'You have a new notification' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [100, 50, 100],
      data: data.data || {},
      actions: data.actions || [],
    })
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.notification.tag);

  event.notification.close();

  // Open or focus the app
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      // Check if app is already open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow('/');
    })
  );
});

// Message handler for client communication
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);

  switch (event.data.type) {
    case 'SKIP_WAITING':
      self.skipWaiting();
      break;

    case 'CACHE_URLS':
      event.waitUntil(
        caches.open(STATIC_CACHE).then((cache) => {
          return cache.addAll(event.data.urls);
        })
      );
      break;

    case 'CLEAR_CACHE':
      event.waitUntil(
        caches.keys().then((names) => {
          return Promise.all(names.map((name) => caches.delete(name)));
        })
      );
      break;
  }
});

console.log('[SW] Service worker loaded');
