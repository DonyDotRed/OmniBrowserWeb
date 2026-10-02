// OmniBrowser Web — 화면 전환(주소 #/…), 명령 팔레트, 화면 색, 북마크릿 수신, 오프라인 설치
import { autoRefreshModels } from './ai.js'
import { renderAbout } from './about.js'
import { renderTools } from './bookmarklets.js'
import { renderDesk } from './desk.js'
import { renderListen } from './listen.js'
import { renderNotes } from './notes.js'
import { renderPlayer } from './player.js'
import { renderSettings } from './settings.js'
import { setDoc } from './state.js'
import * as store from './store.js'
import { renderTranslate } from './translate.js'
import { fmt, toast } from './ui.js'

const ROUTES = {
  '': ['desk', '작업대', renderDesk],
  translate: ['translate', '문서 번역', renderTranslate],
  listen: ['listen', '읽어주기', renderListen],
  player: ['player', '영상 배속', renderPlayer],
  tools: ['tools', '북마크릿', renderTools],
  notes: ['notes', '메모', renderNotes],
  settings: ['settings', '설정', renderSettings],
  about: ['about', '소개·내려받기', renderAbout]
}
const main = document.getElementById('main')
let cleanup = null

function route() {
  const path = location.hash.replace(/^#\/?/, '').split('?')[0]
  const [id, title, render] = ROUTES[path] || ROUTES['']
  if (typeof cleanup === 'function') cleanup()
  cleanup = render(main)
  document.title = `${title} — OmniBrowser Web`
  document.querySelectorAll('.nav').forEach((a) => a.toggleAttribute('aria-current', a.dataset.route === id))
  document.querySelectorAll('.nav[aria-current]').forEach((a) => a.setAttribute('aria-current', 'page'))
  main.focus({ preventScroll: true })
  window.scrollTo(0, 0)
}
window.addEventListener('hashchange', route)

// 화면 색
const applyTheme = () => {
  const t = store.get('theme')
  if (t === 'system') document.documentElement.removeAttribute('data-theme')
  else document.documentElement.dataset.theme = t
}
window.addEventListener('omni:setting', (e) => e.detail.key === 'theme' && applyTheme())
applyTheme()

// ───── 명령 팔레트 (Ctrl+K) ─────
const COMMANDS = [
  ['작업대', '#/', ''], ['문서 번역', '#/translate', ''], ['읽어주기', '#/listen', ''], ['영상 배속', '#/player', ''],
  ['북마크릿 (다른 사이트용 도구)', '#/tools', ''], ['메모', '#/notes', ''], ['설정 · API 키', '#/settings', ''], ['소개 · 데스크톱 앱 내려받기', '#/about', ''],
  ['요약하기', 'run:summarize', '작업대'], ['번역하기', 'run:translate', '작업대'], ['정리 노트 만들기', 'run:organize', '작업대'],
  ['핵심 3줄', 'run:keypoints', '작업대'], ['쉽게 설명', 'run:explain', '작업대'], ['용어 사전', 'run:glossary', '작업대'],
  ['화면 색 바꾸기', 'theme', '']
]
const pal = document.getElementById('palette')
const palIn = document.getElementById('palette-input')
const palList = document.getElementById('palette-list')
let palSel = 0
let palItems = []
function openPalette() {
  pal.hidden = false
  palIn.value = ''
  palSel = 0
  paintPalette()
  palIn.focus()
}
function closePalette() {
  pal.hidden = true
}
function paintPalette() {
  const q = palIn.value.trim().toLowerCase()
  palItems = COMMANDS.filter(([l]) => !q || l.toLowerCase().includes(q))
  palList.replaceChildren(
    ...palItems.map(([l, , where], i) => {
      const li = document.createElement('li')
      li.setAttribute('role', 'option')
      li.setAttribute('aria-selected', i === palSel ? 'true' : 'false')
      li.append(Object.assign(document.createElement('span'), { textContent: l }), Object.assign(document.createElement('span'), { textContent: where }))
      li.addEventListener('click', () => execPalette(i))
      return li
    })
  )
}
function execPalette(i) {
  const it = palItems[i]
  if (!it) return
  closePalette()
  const act = it[1]
  if (act.startsWith('#')) location.hash = act
  else if (act === 'theme') {
    const next = { system: 'dark', dark: 'light', light: 'system' }[store.get('theme')]
    store.set('theme', next)
    toast({ system: 'Windows 설정 따르기', dark: '어둡게', light: '밝게' }[next])
  } else if (act.startsWith('run:')) {
    if (location.hash.replace(/^#\/?/, '').split('?')[0] !== '') location.hash = '#/'
    setTimeout(() => window.dispatchEvent(new CustomEvent('omni:run', { detail: act.slice(4) })), 50)
  }
}
palIn.addEventListener('input', () => ((palSel = 0), paintPalette()))
palIn.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') (palSel = Math.min(palSel + 1, palItems.length - 1)), paintPalette(), e.preventDefault()
  else if (e.key === 'ArrowUp') (palSel = Math.max(palSel - 1, 0)), paintPalette(), e.preventDefault()
  else if (e.key === 'Enter' && !e.isComposing) execPalette(palSel)
  else if (e.key === 'Escape') closePalette()
})
pal.addEventListener('mousedown', (e) => e.target === pal && closePalette())
document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    pal.hidden ? openPalette() : closePalette()
  }
})

// ───── 북마크릿 [AI로 보내기] 받기 ─────
// 다른 사이트의 북마크릿이 이 창을 열고, 준비됐다는 신호를 받으면 페이지 글을 보낸다.
if (/from=bookmarklet/.test(location.hash) && window.opener) {
  window.addEventListener('message', (e) => {
    const d = e.data
    if (!d || d.type !== 'omni-page' || typeof d.text !== 'string') return
    setDoc({ title: String(d.title || '').slice(0, 300), text: d.text.slice(0, 300000), url: /^https?:/.test(d.url) ? d.url : '' })
    toast(`"${d.title || '웹 페이지'}" ${fmt(d.text.length)}자를 받았습니다`)
    history.replaceState(null, '', location.pathname + location.search + '#/')
    if (location.hash !== '#/') location.hash = '#/'
    route()
    if (/^[a-z]+$/.test(d.preset || '')) setTimeout(() => window.dispatchEvent(new CustomEvent('omni:run', { detail: d.preset })), 100)
  })
  window.opener.postMessage('omni-ready', '*')
}

route()
setTimeout(() => autoRefreshModels(), 3000)

// 오프라인에서도 열리도록 (https 또는 localhost에서만)
if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {})
}
