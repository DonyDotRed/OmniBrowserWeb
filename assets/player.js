// 영상 배속 재생기: 내 PC의 영상·음성 파일(또는 직접 주소)을 0.1~10배속으로. OmniBrowser와 같은 단축키
import * as store from './store.js'
import { h, toast } from './ui.js'

const clamp = (r) => Math.round(Math.min(10, Math.max(0.1, r)) * 100) / 100

function srtToVtt(s) {
  return 'WEBVTT\n\n' + s.replace(/\r/g, '').replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2').replace(/^\d+\n(?=\d+:\d+)/gm, '')
}

export function renderPlayer(main) {
  const video = h('video', { controls: true, playsinline: true, preload: 'metadata' })
  const drop = h('div.drop', h('div', h('p', { style: 'font-size:18px;margin:0 0 6px' }, '영상·음성 파일을 여기에 끌어다 놓으세요'), h('p', { style: 'margin:0;opacity:.75' }, 'MP4 · WebM · MP3 · M4A · WAV · 자막(SRT·VTT)')))
  const stage = h('div.stage', video, drop)
  const rateView = h('div.rate', { 'aria-live': 'polite' })
  const loopView = h('div.hint')
  const list = h('ul.playlist')
  const files = []
  let current = -1
  let lastRate = 1
  let loopA = null
  let loopB = null
  let wanted = 1

  const paintRate = () => (rateView.innerHTML = `${video.playbackRate.toFixed(2).replace(/0$/, '')}<small>×</small>`)
  const setRate = (r) => {
    wanted = clamp(r)
    video.playbackRate = wanted
    paintRate()
  }
  // 일부 영상은 스스로 배속을 1.0으로 되돌림 → 다시 적용
  video.addEventListener('ratechange', () => {
    if (Math.abs(video.playbackRate - wanted) > 0.001 && video.playbackRate === 1 && wanted !== 1) video.playbackRate = wanted
    else wanted = video.playbackRate
    paintRate()
  })
  video.addEventListener('timeupdate', () => {
    if (loopA !== null && loopB !== null && video.currentTime >= loopB) video.currentTime = loopA
  })
  video.addEventListener('loadeddata', () => (video.playbackRate = wanted))

  function play(i) {
    current = i
    const f = files[i]
    video.src = f.url
    video.querySelectorAll('track').forEach((t) => t.remove())
    if (f.track) video.append(h('track', { kind: 'subtitles', src: f.track, srclang: 'ko', label: '자막', default: true }))
    drop.hidden = true
    loopA = loopB = null
    loopView.textContent = ''
    paintList()
    video.play().catch(() => {})
  }
  function paintList() {
    list.replaceChildren(...files.map((f, i) => h('li', h('button', { 'aria-current': i === current ? 'true' : 'false', onclick: () => play(i) }, f.name))))
  }
  async function addFiles(fl) {
    const subs = []
    for (const f of fl) {
      if (/\.(srt|vtt)$/i.test(f.name)) subs.push(f)
      else if (/^(video|audio)\//.test(f.type) || /\.(mp4|webm|mkv|mov|mp3|m4a|wav|ogg|flac|aac)$/i.test(f.name))
        files.push({ name: f.name, url: URL.createObjectURL(f) })
    }
    for (const s of subs) {
      const target = files[current >= 0 ? current : files.length - 1]
      if (!target) continue
      const text = await s.text()
      target.track = URL.createObjectURL(new Blob([/\.srt$/i.test(s.name) ? srtToVtt(text) : text], { type: 'text/vtt' }))
      toast('자막을 붙였습니다: ' + s.name)
    }
    paintList()
    if (current < 0 && files.length) play(0)
    else if (subs.length && current >= 0) play(current)
  }
  const fileIn = h('input', { type: 'file', multiple: true, hidden: true, accept: 'video/*,audio/*,.srt,.vtt,.mkv' })
  fileIn.addEventListener('change', () => addFiles([...fileIn.files]))
  stage.addEventListener('dragover', (e) => e.preventDefault())
  stage.addEventListener('drop', (e) => {
    e.preventDefault()
    addFiles([...e.dataTransfer.files])
  })

  const urlIn = h('input', { type: 'url', placeholder: '영상 파일 주소 (https://…/video.mp4)', 'aria-label': '영상 주소', style: 'flex:1;min-width:200px' })
  const urlBtn = h('button.btn', {
    onclick: () => {
      const u = urlIn.value.trim()
      if (!/^https?:\/\//.test(u)) return toast('http(s) 주소를 넣으세요')
      files.push({ name: u.split('/').pop() || u, url: u })
      play(files.length - 1)
    }
  }, '열기')

  const key = (e) => {
    if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return
    const k = e.key.toLowerCase()
    const step = e.shiftKey ? 0.5 : 0.1
    const fav = Number(store.get('favoriteRate')) || 1.5
    const acts = {
      s: () => setRate(video.playbackRate - step),
      d: () => setRate(video.playbackRate + step),
      r: () => {
        if (video.playbackRate !== 1) {
          lastRate = video.playbackRate
          setRate(1)
        } else setRate(lastRate)
      },
      g: () => setRate(fav),
      z: () => (video.currentTime -= 10),
      x: () => (video.currentTime += 10),
      ',': () => (video.pause(), (video.currentTime -= 1 / 30)),
      '.': () => (video.pause(), (video.currentTime += 1 / 30)),
      '[': () => ((loopA = video.currentTime), (loopView.textContent = `반복 시작 ${loopA.toFixed(1)}초 — ]로 끝 지정`)),
      ']': () => {
        if (loopA === null) return
        loopB = video.currentTime
        if (loopB <= loopA) return (loopB = null)
        loopView.textContent = `${loopA.toFixed(1)}초 ~ ${loopB.toFixed(1)}초 반복 중 (\\ 해제)`
      },
      '\\': () => ((loopA = loopB = null), (loopView.textContent = '')),
      p: () =>
        Promise.resolve()
          .then(() => (document.pictureInPictureElement ? document.exitPictureInPicture() : video.requestPictureInPicture()))
          .catch(() => toast('이 브라우저는 PiP를 지원하지 않습니다')),
      f: () => (document.fullscreenElement ? document.exitFullscreen() : stage.requestFullscreen()),
      ' ': () => (video.paused ? video.play() : video.pause())
    }
    if (acts[k] && video.src) {
      e.preventDefault()
      acts[k]()
    }
  }
  document.addEventListener('keydown', key)

  const quick = [0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4].map((r) => h('button.chip', { onclick: () => setRate(r) }, r + '×'))
  const keys = [
    ['S / D', '0.1 느리게 / 빠르게 (Shift: 0.5씩)'],
    ['R', '1.0× ↔ 직전 배속'],
    ['G', `즐겨찾기 배속 (${store.get('favoriteRate')}×, 설정에서 변경)`],
    ['Z / X', '10초 뒤로 / 앞으로'],
    [', / .', '한 프레임씩'],
    ['[ / ] / \\', '구간 반복 시작 / 끝 / 해제'],
    ['P / F', 'PiP / 전체 화면'],
    ['Space', '재생 / 일시정지']
  ]

  main.replaceChildren(
    h('header.head', h('div.grow', h('h1', '영상 배속'), h('p', '내 PC의 강의·회의 녹화 파일을 0.1~10배속으로 봅니다. 파일은 이 브라우저 밖으로 나가지 않습니다.')),
      h('div.row', h('button.btn.primary', { onclick: () => fileIn.click() }, '파일 열기'), fileIn)),
    h('div.pad',
      h('div.cols', { style: 'grid-template-columns:minmax(0,2fr) minmax(260px,1fr)' },
        h('div', stage, h('div.row', quick), h('div.row', urlIn, urlBtn)),
        h('div',
          h('div.panel', rateView, loopView, h('div.row', h('button.btn', { onclick: () => setRate(video.playbackRate - 0.1) }, '− 0.1'), h('button.btn', { onclick: () => setRate(video.playbackRate + 0.1) }, '+ 0.1'))),
          h('div.panel', h('h2', '단축키'), h('div.keys', keys.flatMap(([k, d]) => [h('kbd', k), h('span', d)]))),
          h('div.panel', h('h2', '재생 목록'), list, h('p.hint', '다른 사이트(YouTube·인강)의 영상은 "북마크릿 → 배속 조절"을 쓰세요.'))
        )
      )
    )
  )
  paintRate()
  return () => {
    document.removeEventListener('keydown', key)
    video.pause()
  }
}
