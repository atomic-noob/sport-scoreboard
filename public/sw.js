/* Sylve service worker: lets the app open and keep working when the connection is bad or gone.
 *  - Pages: network first, then the saved copy of the app (it is one page that handles every route).
 *  - Built files (/assets/...): saved on first use, then served from the phone.
 *  - Supabase data reads (GET /rest/v1/...): network first with a short wait, then the last copy.
 * Anything that writes (POST, PATCH, DELETE), sign-in and realtime are never touched. */
const SHELL = 'sylve-shell-v1'
const ASSETS = 'sylve-assets-v1'
const DATA = 'sylve-data-v1'
const KEEP = [SHELL, ASSETS, DATA]
const WAIT_MS = 5000

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sylve-') && !KEEP.includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('message', (event) => {
  // Sent on sign-out so a shared phone does not keep the last user's data.
  if (event.data === 'clear-data') event.waitUntil(caches.delete(DATA))
})

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms)
    promise.then((r) => { clearTimeout(t); resolve(r) }, (e) => { clearTimeout(t); reject(e) })
  })
}

async function networkFirst(request, cacheName, cacheKey, wait) {
  const cache = await caches.open(cacheName)
  const key = cacheKey ?? request
  const network = fetch(request).then((res) => {
    if (res && res.ok) cache.put(key, res.clone())
    return res
  })
  try {
    return await withTimeout(network, wait)
  } catch {
    const cached = await cache.match(key)
    if (cached) return cached
    return network // nothing saved: wait for the real answer (or its error)
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate' && url.origin === self.location.origin) {
    event.respondWith(networkFirst(request, SHELL, '/index.html', WAIT_MS))
    return
  }

  if (url.origin === self.location.origin && url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(request)
        if (hit) return hit
        const res = await fetch(request)
        if (res.ok) cache.put(request, res.clone())
        return res
      })
    )
    return
  }

  if (url.pathname.startsWith('/rest/v1/') && url.hostname.endsWith('.supabase.co')) {
    event.respondWith(networkFirst(request, DATA, undefined, WAIT_MS))
  }
})
