/* VECC Calculation Tools — service worker
   업데이트 방법: 파일을 수정해 올릴 때 아래 VERSION 숫자를 하나 올리면
   모든 기기가 다음 접속 때 새 파일을 받습니다. */
const VERSION = 'v10';
const CACHE = 'kuvecc-' + VERSION;
const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './tools/bloodgas.html',
  './tools/anesthesia.html',
  './tools/saccm.html',
  './data/saccm/toc.json',
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
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
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

  /* SACCM 요약 데이터(data/saccm/): 저장된 파일이 있으면 즉시 응답하고, 뒤에서 서버의 새 버전을 받아 캐시를 갱신
     (stale-while-revalidate). 처음 여는 챕터만 네트워크에서 받습니다.
     주소에 ?fresh 가 붙은 요청(뷰어가 뒤에서 목차 변경을 확인할 때)만 네트워크 우선입니다. */
  if (sameOrigin && url.pathname.includes('/data/saccm/')) {
    const key = url.origin + url.pathname;  // ?fresh 같은 쿼리는 떼고 같은 이름으로 저장
    const offline = () => new Response('', { status: 504, statusText: 'offline' });
    const fresh = url.searchParams.has('fresh');
    const network = fetch(key, { cache: fresh ? 'no-store' : 'no-cache' }).then((res) => {
      if (!res || !res.ok) return res;
      const copy = res.clone();
      return caches.open(CACHE).then((c) => c.put(key, copy)).then(() => res, () => res);
    });
    if (fresh) {
      e.respondWith(network.catch(() => caches.open(CACHE).then((c) => c.match(key)).then((hit) => hit || offline())));
      return;
    }
    e.waitUntil(network.catch(() => null));
    e.respondWith(caches.open(CACHE).then((c) => c.match(key)).then((hit) => hit || network.catch(offline)));
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
