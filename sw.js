const cacheName = 'lehrzeit-v4-' + self.registration.scope;
const assets = ['./', './index.html', './style.css', './app.js', './manifest.webmanifest', './icon.png'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets.map(asset => new Request(new URL(asset,self.registration.scope),{cache:'reload'})))));
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
const urls = assets.map(asset => new URL(asset, self.registration.scope).href);
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || !urls.includes(event.request.url)) return;
  event.respondWith(caches.open(cacheName).then(cache => cache.match(event.request))
    .then(response => response || fetch(event.request)));
});
