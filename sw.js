// 灵光 Service Worker
// 策略：HTML 永远走网络（保证刷新就是最新版），只缓存不变的静态资源
const CACHE = 'lingguang-v3';
const STATIC = ['/manifest.json', '/icon-180.png', '/icon-512.png'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(STATIC)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // API 请求不缓存
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;

  // HTML / 页面请求：始终走网络，确保用户刷新就能拿到最新版本
  const isHTML = req.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html');
  if (isHTML) {
    e.respondWith(fetch(req).catch(() => caches.match('/index.html')));
    return;
  }

  // 静态资源（图标等）：缓存优先
  e.respondWith(
    caches.match(req).then((r) => r || fetch(req).then((res) => {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
