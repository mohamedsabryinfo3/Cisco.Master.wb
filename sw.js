/* IOS Master — service worker
   Purpose: the site keeps working with no connection (a study reference is
   useless on a plane or in a lab room with no Wi-Fi).
   Strategy: network-first for navigations (so updates land), cache-first with
   background refresh for static assets. */

const CACHE = "iosmaster-v4";

const PRECACHE = [
  "./",
  "index.html",
  "404.html",
  "manifest.webmanifest",
  "assets/app.css",
  "assets/core.js",
  "assets/boot.js",
  "assets/view-commands.js",
  "assets/view-questions.js",
  "assets/view-tools.js",
  "assets/view-misc.js",
  "assets/view-subnet.js",
  "assets/subnet-core.js",
  "assets/data-commands.js",
  "assets/data-questions.js",
  "assets/favicon.svg",
  "assets/icon-192.png",
  "assets/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.origin !== location.origin) return; // fonts/CDN go straight to network

  // navigations: try network, fall back to the cached shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || caches.match("index.html")))
    );
    return;
  }

  // assets: cache first, refresh in the background
  event.respondWith(
    caches.match(req).then((hit) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit);
      return hit || network;
    })
  );
});
