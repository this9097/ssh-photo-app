// 배포할 때마다 이 버전 문자열을 바꿔주세요 (예: v3, v4 ...)
// 버전이 바뀌면 새 캐시가 만들어지고, 접속자들은 자동으로 최신 버전으로 갱신됩니다.
const CACHE_VERSION = 'v2';
const CACHE_NAME = 'photo-studio-' + CACHE_VERSION;
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 다른 도메인 요청(예: 얼굴 인식 모델 CDN)은 서비스워커가 손대지 않고 그대로 통과시킨다.
  // 이걸 캐시 로직에 태우면 큰 바이너리 파일 로딩이 깨져서 인식 실패로 이어질 수 있다.
  if (url.origin !== self.location.origin) {
    return;
  }

  const isHTML = req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');

  if (isHTML) {
    // HTML은 항상 최신을 우선 시도 (network-first) — 오래된 화면이 캐시되는 것을 방지
    event.respondWith(
      fetch(req).then(res => {
        caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
  } else {
    // 아이콘 등 정적 자원은 cache-first
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        caches.open(CACHE_NAME).then(cache => cache.put(req, res.clone()));
        return res;
      }))
    );
  }
});
