/* VECC Calculation Tools — service worker
   업데이트 방법: 파일을 수정해 올릴 때 아래 VERSION 숫자를 하나 올리면
   모든 기기가 다음 접속 때 새 파일을 받습니다. */
const VERSION = 'v13';
const CACHE = 'kuvecc-' + VERSION;
/* 교재·자료 데이터(data/) 저장소. js/data-sync.js가 채우며 VERSION과 무관하게 유지됩니다. */
const DATA_CACHE = 'kuvecc-data';
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './tools/bloodgas.html',
  './tools/anesthesia.html',
  './tools/saccm.html',
  './js/data-sync.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.all(PRECACHE.map((u) => c.add(u).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE && k !== DATA_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 같은 사이트 파일: 캐시가 있으면 즉시 캐시로 응답하고, 뒤에서 네트워크로 새 버전을 받아 캐시를 갱신
   (stale-while-revalidate). 오프라인·신호 약한 곳에서도 바로 뜨고, 온라인이면 다음 열 때 최신이 됩니다.
   외부(폰트 등): 캐시 있으면 캐시, 없으면 네트워크. 실패해도 페이지는 시스템 글꼴로 뜹니다. */
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  /* 데이터 파일(data/): 기기에 저장된 것이 있으면 바로 응답합니다. 새 파일·수정본은 js/data-sync.js가
     manifest.json을 보고 미리 받아 두므로 여기서는 서버를 기다리지 않습니다.
     주소에 ?가 붙은 요청(manifest 확인, 동기화 내려받기)만 서버로 바로 보냅니다. */
  if (sameOrigin && url.pathname.includes('/data/')) {
    if (url.search) { e.respondWith(fetch(req)); return; }
    e.respondWith(
      caches.open(DATA_CACHE).then((cache) =>
        cache.match(req).then((hit) => hit || fetch(req).then((res) => {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(() => new Response('', { status: 504, statusText: 'offline' })))
      )
    );
    return;
  }

  e.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req, { ignoreSearch: sameOrigin }).then((cached) => {
        const network = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
          return res;
        }).catch(() => null);
        if (cached) { return cached; }
        return network.then((res) => {
          if (res) return res;
          if (req.mode === 'navigate') return cache.match('./index.html');
          return new Response('', { status: 504, statusText: 'offline' });
        });
      })
    )
  );
});
