const CACHE='brezova-web-20261106-v5';
const FILES=['./','./index.html','./style.css?v=20261106-audit31','./config.js?v=20261106-audit31','./data-model.js','./persistence.js','./catalog-data.js?v=jidelnicky2-soulad1','./catalog.js?v=jidelnicky2-soulad1','./github-sync.js?v=20261106-audit31','./app.js?v=20261106-audit31','./strava-import.js?v=20261106-audit31','./napoveda.html?v=22','./favicon.ico?v=1'];
self.addEventListener('install',event=>event.waitUntil((async()=>{const cache=await caches.open(CACHE);for(const path of FILES){const response=await fetch(path,{cache:'reload'});if(response.ok&&!response.redirected)await cache.put(path,response)}await self.skipWaiting()})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith('brezova-web-')&&key!==CACHE)await caches.delete(key);await self.clients.claim()})()));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/api/'))return;
 event.respondWith((async()=>{try{return await fetch(event.request)}catch{const cache=await caches.open(CACHE);return await cache.match(event.request)||await cache.match(url.pathname)||(event.request.mode==='navigate'?await cache.match('./'):null)||new Response('Offline',{status:503})}})());
});
