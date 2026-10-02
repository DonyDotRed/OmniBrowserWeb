// 오프라인 지원: 이 사이트의 파일만 저장해 두고(먼저 저장본을 보여 준 뒤 새 버전으로 갱신),
// AI·TTS 요청(다른 회사 주소)은 저장하지 않는다.
const CACHE = 'omniweb-v1'
const CORE = [
  './', 'index.html', 'manifest.webmanifest', 'assets/app.css', 'assets/app.js', 'assets/ai.js', 'assets/store.js', 'assets/ui.js',
  'assets/state.js', 'assets/desk.js', 'assets/files.js', 'assets/translate.js', 'assets/tts.js', 'assets/listen.js',
  'assets/player.js', 'assets/bookmarklets.js', 'assets/notes.js', 'assets/settings.js', 'assets/about.js',
  'vendor/marked.esm.js', 'vendor/purify.es.mjs', 'icons/icon-192.png', 'icons/favicon.png'
]
self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  )
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/downloads/')) return
  e.respondWith(
    caches.open(CACHE).then(async (c) => {
      const hit = await c.match(e.request, { ignoreSearch: true })
      const fresh = fetch(e.request)
        .then((res) => {
          if (res.ok) c.put(e.request, res.clone())
          return res
        })
        .catch(() => hit)
      return hit || fresh
    })
  )
})
