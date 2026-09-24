/* 意语职场通 Service Worker —— 只缓存音频 mp3，绝不拦截 html/js/css，
   因此站点改版永远不会被旧缓存挡住；音频内容更新时只需修改 CACHE 版本号。 */
const CACHE = 'lavoro-it-audio-v1';

self.addEventListener('install', function(e){ self.skipWaiting(); });
self.addEventListener('activate', function(e){ e.waitUntil(self.clients.claim()); });

self.addEventListener('fetch', function(event){
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (!url.pathname.endsWith('.mp3')) return;   // 仅接管音频

  event.respondWith((async function(){
    const cache = await caches.open(CACHE);
    let hit = await cache.match(req);
    if (!hit) {
      const res = await fetch(req);
      if (!res || res.status !== 200) return res;
      const buf = await res.arrayBuffer();
      const headers = new Headers(res.headers);
      await cache.put(req, new Response(buf, { status: 200, headers: headers }));
      hit = new Response(buf, { status: 200, headers: headers });
    }
    // 兼容 <audio> 的 Range 请求：命中缓存时切片返回 206
    const range = req.headers.get('Range');
    if (!range) return hit;
    const total = parseInt(hit.headers.get('Content-Length') || '0', 10);
    const mm = range.match(/bytes=(\d*)-(\d*)/);
    if (!mm || !total) return hit;
    const start = mm[1] ? parseInt(mm[1], 10) : 0;
    const end = mm[2] ? parseInt(mm[2], 10) : total - 1;
    if (start >= total || start > end) {
      return new Response(null, { status: 416, headers: { 'Content-Range': 'bytes */' + total } });
    }
    const ab = await hit.arrayBuffer();
    const slice = ab.slice(start, end + 1);
    const h = new Headers(hit.headers);
    h.set('Content-Range', 'bytes ' + start + '-' + end + '/' + total);
    h.set('Accept-Ranges', 'bytes');
    h.set('Content-Length', String(slice.byteLength));
    return new Response(slice, { status: 206, headers: h });
  })());
});
