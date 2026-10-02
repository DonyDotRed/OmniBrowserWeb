// 북마크릿: 즐겨찾기 막대에 끌어다 두고, 아무 사이트에서나 눌러 쓰는 작은 도구.
// 각 함수는 그 사이트 안에서 실행된다 (이 웹판의 API 키나 데이터에는 접근하지 않음).
import { h, toast } from './ui.js'

/* eslint-disable no-undef */

// ① 배속 조절: 페이지의 모든 영상·음성(같은 출처의 iframe 포함)에 0.1~10배속 + 단축키
function speed() {
  const W = window
  if (W.__omniSpeed) return W.__omniSpeed.toggle()
  let rate = 1
  let last = 1
  const media = () => {
    const out = [...document.querySelectorAll('video,audio')]
    for (const f of document.querySelectorAll('iframe')) {
      try {
        out.push(...f.contentDocument.querySelectorAll('video,audio'))
      } catch (e) {}
    }
    return out
  }
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;z-index:2147483647;top:12px;right:12px;background:#232a6b;color:#fff;font:600 14px/1.2 system-ui,sans-serif;padding:8px 10px;border-radius:10px;box-shadow:0 6px 20px #0005;display:flex;gap:6px;align-items:center'
  const show = document.createElement('b')
  show.style.cssText = 'min-width:52px;text-align:center;font-size:18px'
  const btn = (t, f) => {
    const b = document.createElement('button')
    b.textContent = t
    b.style.cssText = 'all:unset;cursor:pointer;background:#ffffff22;padding:3px 8px;border-radius:6px'
    b.onclick = f
    return b
  }
  const apply = (r) => {
    rate = Math.round(Math.min(10, Math.max(0.1, r)) * 100) / 100
    media().forEach((m) => (m.playbackRate = rate))
    show.textContent = rate + '×'
  }
  box.append(btn('−', () => apply(rate - 0.1)), show, btn('+', () => apply(rate + 0.1)), btn('1×', () => apply(1)), btn('2×', () => apply(2)), btn('✕', () => W.__omniSpeed.toggle()))
  document.body.append(box)
  apply(media()[0] ? media()[0].playbackRate : 1)
  const keys = (e) => {
    const t = e.target
    if (t.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(t.tagName) || e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key.toLowerCase()
    const s = e.shiftKey ? 0.5 : 0.1
    const m = media()[0]
    const a = {
      s: () => apply(rate - s),
      d: () => apply(rate + s),
      r: () => (rate !== 1 ? ((last = rate), apply(1)) : apply(last)),
      z: () => m && (m.currentTime -= 10),
      x: () => m && (m.currentTime += 10)
    }[k]
    if (a) {
      e.preventDefault()
      e.stopPropagation()
      a()
    }
  }
  document.addEventListener('keydown', keys, true)
  // 사이트가 배속을 1로 되돌리면 다시 적용
  const timer = setInterval(() => media().forEach((m) => Math.abs(m.playbackRate - rate) > 0.01 && (m.playbackRate = rate)), 700)
  W.__omniSpeed = {
    toggle() {
      box.remove()
      document.removeEventListener('keydown', keys, true)
      clearInterval(timer)
      delete W.__omniSpeed
    }
  }
}

// ② PiP: 가장 큰 영상을 작은 창으로 (사이트가 막아 둔 경우도 해제)
function pip() {
  const v = [...document.querySelectorAll('video')].sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0]
  if (!v) return alert('이 페이지에서 영상을 찾지 못했습니다.')
  if (document.pictureInPictureElement) return document.exitPictureInPicture()
  v.disablePictureInPicture = false
  v.removeAttribute('disablepictureinpicture')
  v.requestPictureInPicture().catch((e) => alert('PiP 실패: ' + e.message))
}

// ③ 다크 모드: 페이지 색을 반전 (사진·영상은 원래 색 유지). 한 번 더 누르면 해제
function dark() {
  const id = '__omni_dark'
  const old = document.getElementById(id)
  if (old) return old.remove()
  const s = document.createElement('style')
  s.id = id
  s.textContent = 'html{filter:invert(.92) hue-rotate(180deg)!important;background:#fff!important}img,video,picture,canvas,iframe,svg image,[style*="background-image"]{filter:invert(1) hue-rotate(180deg)!important}'
  document.documentElement.append(s)
}

// ④ 소리 내어 읽기: 선택한 글(없으면 본문)을 브라우저 내장 음성으로. 다시 누르면 멈춤
function speak() {
  if (speechSynthesis.speaking) return speechSynthesis.cancel()
  const sel = String(getSelection()).trim()
  const main = document.querySelector('article, main, [role=main]') || document.body
  const text = (sel || main.innerText).slice(0, 30000)
  const ko = (text.match(/[가-힣]/g) || []).length > text.length * 0.2
  for (const part of text.match(/[^.!?。\n]+[.!?。]?/g) || []) {
    const u = new SpeechSynthesisUtterance(part.trim())
    u.lang = ko ? 'ko-KR' : 'en-US'
    u.rate = 1.1
    speechSynthesis.speak(u)
  }
}

// ⑤ 문서 링크 모으기: 이 페이지의 PDF·HWP·Word·Excel·PPT·ZIP 링크를 목록으로 보여 주고 골라서 한 번에 받기
function docs() {
  const exts = /\.(pdf|hwp|hwpx|doc|docx|xls|xlsx|csv|ppt|pptx|zip|7z|txt)(?:$|[?#])/i
  const seen = new Set()
  const items = []
  for (const a of document.querySelectorAll('a[href]')) {
    const u = a.href
    if (seen.has(u) || !(exts.test(u) || /download|filedown|atch|attach/i.test(u))) continue
    seen.add(u)
    items.push({ u, t: (a.innerText || a.title || u.split('/').pop()).trim().slice(0, 120) })
  }
  if (!items.length) return alert('이 페이지에서 문서 링크를 찾지 못했습니다.')
  const box = document.createElement('div')
  box.style.cssText = 'position:fixed;z-index:2147483647;inset:5% 10%;background:#fff;color:#1c2433;font:14px/1.5 system-ui,sans-serif;border-radius:14px;box-shadow:0 20px 60px #0007;display:flex;flex-direction:column;overflow:hidden'
  const head = document.createElement('div')
  head.style.cssText = 'padding:12px 16px;background:#232a6b;color:#fff;display:flex;gap:10px;align-items:center'
  const cap = document.createElement('b')
  cap.style.flex = '1'
  cap.textContent = '문서 링크 ' + items.length + '개'
  head.append(cap)
  const list = document.createElement('div')
  list.style.cssText = 'overflow:auto;padding:8px 16px;flex:1'
  items.forEach((it, i) => {
    const row = document.createElement('label')
    row.style.cssText = 'display:flex;gap:8px;padding:4px 0;border-bottom:1px solid #eee'
    const c = document.createElement('input')
    c.type = 'checkbox'
    c.checked = true
    c.dataset.i = i
    const span = document.createElement('span')
    span.textContent = it.t + '  —  ' + decodeURIComponent(it.u.split('/').pop().split('?')[0] || it.u)
    row.append(c, span)
    list.append(row)
  })
  const mk = (t, f) => {
    const b = document.createElement('button')
    b.textContent = t
    b.style.cssText = 'all:unset;cursor:pointer;background:#ffffff22;padding:4px 10px;border-radius:6px'
    b.onclick = f
    head.append(b)
  }
  const picked = () => [...list.querySelectorAll('input:checked')].map((c) => items[c.dataset.i])
  mk('모두 선택/해제', () => {
    const all = list.querySelectorAll('input')
    const on = [...all].some((c) => !c.checked)
    all.forEach((c) => (c.checked = on))
  })
  mk('목록 복사', () => {
    navigator.clipboard.writeText(picked().map((x) => x.t + '\t' + x.u).join('\n'))
    alert('복사했습니다 (엑셀에 붙여넣기 가능)')
  })
  mk('선택 항목 받기', async () => {
    const p = picked()
    if (!confirm(p.length + '개 파일을 차례로 받습니다. 브라우저가 "여러 파일 다운로드 허용"을 물으면 허용하세요.')) return
    for (const it of p) {
      const a = document.createElement('a')
      a.href = it.u
      a.download = ''
      a.rel = 'noopener'
      document.body.append(a)
      a.click()
      a.remove()
      await new Promise((r) => setTimeout(r, 700))
    }
  })
  mk('닫기', () => box.remove())
  box.append(head, list)
  document.body.append(box)
}

// ⑥ AI로 보내기: 선택한 글(없으면 본문)을 OmniBrowser Web 작업대로 보냄. preset이 있으면 바로 실행
function send(site, preset) {
  const sel = String(getSelection()).trim()
  const main = document.querySelector('article, main, [role=main]') || document.body
  const data = { type: 'omni-page', title: document.title, url: location.href, text: (sel || main.innerText).slice(0, 300000), preset: preset || '' }
  const w = window.open(site + '#/?from=bookmarklet', 'omniweb')
  if (!w) return alert('팝업이 차단되었습니다. 이 사이트의 팝업을 허용한 뒤 다시 누르세요.')
  const origin = new URL(site).origin
  const onMsg = (e) => {
    if (e.source === w && e.data === 'omni-ready') {
      w.postMessage(data, origin)
      removeEventListener('message', onMsg)
    }
  }
  addEventListener('message', onMsg)
  setTimeout(() => removeEventListener('message', onMsg), 20000)
}

const code = (fn, ...args) => 'javascript:' + encodeURIComponent(`(${fn.toString()})(${args.map((a) => JSON.stringify(a)).join(',')});void 0`)

export function renderTools(main) {
  const site = location.origin + location.pathname
  const items = [
    ['배속 조절', code(speed), 'YouTube·인강 등 아무 사이트의 영상을 0.1~10배속으로. 오른쪽 위에 조절 막대가 생기고 S/D(±0.1), Shift+S/D(±0.5), R(1×↔직전), Z/X(10초) 단축키가 동작합니다. 사이트가 배속을 되돌려도 다시 맞춥니다.'],
    ['AI로 보내기', code(send, site, ''), '보고 있는 페이지(또는 드래그한 부분)를 이 작업대로 보냅니다. 로그인해야 보이는 페이지도 그대로 가져옵니다.'],
    ['AI 요약', code(send, site, 'summarize'), '보내자마자 요약까지 실행합니다.'],
    ['AI 번역', code(send, site, 'translate'), '보내자마자 번역합니다. 결과 언어는 설정에서 고릅니다.'],
    ['문서 링크 모으기', code(docs), '이 페이지의 PDF·HWP·Word·Excel·PPT·ZIP 링크를 목록으로 보여 주고, 골라서 한 번에 받거나 목록을 엑셀용으로 복사합니다.'],
    ['소리 내어 읽기', code(speak), '드래그한 글(없으면 본문)을 브라우저 내장 음성으로 읽습니다. 다시 누르면 멈춥니다.'],
    ['PiP', code(pip), '가장 큰 영상을 작은 창으로 띄웁니다. 사이트가 막아 둔 경우도 풀어서 시도합니다.'],
    ['다크 모드', code(dark), '밝은 페이지를 어둡게. 한 번 더 누르면 원래대로.']
  ]
  main.replaceChildren(
    h('header.head', h('div.grow', h('h1', '북마크릿'), h('p', '아래 단추를 브라우저의 즐겨찾기(북마크) 막대로 끌어다 놓으세요. 그다음 아무 사이트에서나 눌러 씁니다.'))),
    h('div.pad',
      h('div.panel',
        h('p.lead', '즐겨찾기 막대가 안 보이면 Ctrl+Shift+B. 휴대폰에서는 끌어다 놓기가 안 되므로 PC에서 쓰세요.'),
        items.map(([name, href, desc]) =>
          h('div.bm',
            h('div', h('a.bm-link', { href, title: '즐겨찾기 막대로 끌어다 놓으세요', onclick: (e) => (e.preventDefault(), toast('누르지 말고 즐겨찾기 막대로 끌어다 놓으세요')) }, name)),
            h('div', h('h3', name), h('p', desc))
          )
        )
      ),
      h('div.panel', h('h2', '알아 둘 점'),
        h('ul',
          h('li', '"AI로 보내기"는 이 주소(', h('code', site), ')로 보냅니다. 사이트를 옮기면 북마크릿을 다시 끌어다 놓으세요.'),
          h('li', '일부 사이트(은행·보안이 강한 사이트)는 북마크릿 실행을 막습니다.'),
          h('li', '"문서 링크 모으기"는 이 페이지에 보이는 링크만 모읍니다. 하위 페이지까지 자동으로 모으는 크롤러는 데스크톱 OmniBrowser에 있습니다.')
        )
      )
    )
  )
}
