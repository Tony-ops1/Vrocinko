const CACHE='vrocinko-v15';
const FILES=['./','./index.html','./style.css','./background.css','./background.js','./app.js','./edit.js','./days.js','./manifest.json','./icon.svg','./assets/bgw1.txt','./assets/bgw2.txt','./assets/bgw3.txt','./assets/bgw4.txt','./assets/bgw5.txt','./assets/bgw6.txt'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET') return;
  event.respondWith(
    fetch(event.request)
      .then(response=>{
        const copy=response.clone();
        caches.open(CACHE).then(cache=>cache.put(event.request,copy));
        return response;
      })
      .catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html')))
  );
});
