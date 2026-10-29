// Zombie Bash service worker: caches the game so it starts instantly and plays offline.
// Files are served from cache first and refreshed in the background, so an update
// shows up the next time the game is opened.
const CACHE = 'zbash-v35';
const ASSETS = [
  './',
  'index.html',
  'style.css',
  'js/data.js',
  'js/levels.js',
  'js/art.js',
  'js/buildings.js',
  'js/terrain.js',
  'js/zombies.js',
  'js/wonders.js',
  'js/manga.js',
  'js/scenes.js',
  'js/story.js',
  'js/missions.js',
  'js/comms.js',
  'js/sandbox.js',
  'js/weather.js',
  'js/animals.js',
  'js/globe.js',
  'js/menufx.js',
  'js/music.js',
  'js/audio.js',
  'js/coach.js',
  'js/game.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/apple-touch-icon.png',
  'fonts/fonts.css',
  'fonts/barlow-400.woff2',
  'fonts/barlow-500.woff2',
  'fonts/barlow-600.woff2',
  'fonts/barlow-700.woff2',
  'fonts/barlow-condensed-500.woff2',
  'fonts/barlow-condensed-600.woff2',
  'fonts/barlow-condensed-700.woff2',
  'fonts/barlow-condensed-800.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const font = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !font) return;
  e.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(req, { ignoreSearch: sameOrigin });
    const fresh = fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
        return res;
      })
      .catch(() => cached);
    return cached || fresh;
  }));
});
