/* DiaMerna — Service Worker
   Provides offline caching + push notification support.
   ⚠️ No API keys here — this is in the public GitHub source. */

const CACHE = 'diamerna-v1'
const ASSETS = [
  '/',
  '/index.html',
  '/glucose.html',
  '/baby.html',
  '/health.html',
  '/chat.html',
  '/more.html',
  '/admin.html',
  '/css/style.css',
  '/js/modules/auth.js',
  '/js/modules/sidebar.js',
  '/js/modules/page-nav.js',
  '/js/modules/ai-chat.js',
  '/js/modules/extra-features.js',
  '/js/config.js',
  '/logo.jpeg',
  '/manifest.json'
]

/* Install — cache core assets */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return c.addAll(ASSETS).catch(err => {
        console.warn('SW cache addAll partial fail:', err.message)
      })
    })
  )
  self.skipWaiting()
})

/* Activate — clean old caches */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  )
  self.clients.claim()
})

/* Fetch — network first, fallback to cache */
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request).then(r => r || fetch(e.request)))
  )
})

/* Push notifications from server */
self.addEventListener('push', e => {
  if (!e.data) return
  let data = {}
  try { data = e.data.json() } catch { data = { title: 'DiaMerna', body: e.data.text() } }
  e.waitUntil(
    self.registration.showNotification(data.title || 'DiaMerna', {
      body: data.body || '',
      icon: '/logo.jpeg',
      badge: '/logo.jpeg',
      vibrate: [200, 100, 200],
      tag: 'diamerna',
      data: { url: data.url || '/' }
    })
  )
})

/* Click notification → open app */
self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.openWindow(e.notification.data.url || '/'))
})
