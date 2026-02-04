const CACHE = "diodenlab-v1";
const FILES = [
  "index_plotly.html",
  "lab_plotly.js",
  "plotly-2.29.1.min.js",
  "manifest.json",
  "styles.css"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(FILES))
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => response || fetch(event.request))
  );
});
