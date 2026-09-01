const CACHE='vrocinko-recovery-v24';

self.addEventListener('install',event=>{
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

// Recovery service worker intentionally does not intercept requests.
// The browser loads the current app files directly from the network.
