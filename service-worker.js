const CACHE_NAME = "atoumoulin-cache-v2";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./style.css",
  "./script.js",
  "./multiplayer.js",
  "./manifest.json",
  "./1789034496969.png",

  "./cartes/01.png",
  "./cartes/02.png",
  "./cartes/03.png",
  "./cartes/04.png",
  "./cartes/05.png",
  "./cartes/06.png",
  "./cartes/07.png",
  "./cartes/08.png",
  "./cartes/09.png",
  "./cartes/10.png",
  "./cartes/11.png",
  "./cartes/12.png",
  "./cartes/13.png",
  "./cartes/14.png",
  "./cartes/15.png",
  "./cartes/16.png",
  "./cartes/17.png",
  "./cartes/18.png",
  "./cartes/19.png",
  "./cartes/20.png",
  "./cartes/21.png",
  "./cartes/joker.png",
  "./cartes/dos.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, copy);
          });
        }

        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
