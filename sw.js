// Service Worker：快取 App 本體，讓 App 可以離線使用。
// ⚠️ 每次修改任何檔案後，請把 VERSION 加一，使用者才會拿到新版。
const VERSION = 'v4';
const CACHE = `habit-tracker-${VERSION}`;
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/date.js',
  './js/store.js',
  './js/stats.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('habit-tracker-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 快取優先；沒有快取時才走網路。頁面導覽一律回傳 index.html（離線也能開）。
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;

  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((r) => r || fetch(req)),
    );
    return;
  }
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)),
  );
});
