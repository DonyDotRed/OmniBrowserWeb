// 읽어주기 화면: 글을 문장으로 나눠 소리 내어 읽고, 읽는 문장을 표시
import { doc, listenQueue } from './state.js'
import * as store from './store.js'
import * as tts from './tts.js'
import { download, errText, h, safeName, toast } from './ui.js'

let reader = null

export function renderListen(main) {
  let text = listenQueue.text || doc.text
  const title = listenQueue.title || doc.title || '글'
  listenQueue.text = ''
  listenQueue.title = ''
  let list = tts.sentences(text)
  const view = h('div.listen-text', { lang: 'ko' })
  const status = h('span.hint')
  const rateOut = h('output', `${store.get('tts.rate')}×`)
  const rate = h('input', { type: 'range', min: 0.5, max: 3, step: 0.1, value: store.get('tts.rate'), 'aria-label': '읽기 속도' })
  const playBtn = h('button.run', { type: 'button', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4l13 8-13 8z"/></svg><span>처음부터 읽기</span>' })
  const pauseBtn = h('button.btn', '일시정지')
  const stopBtn = h('button.btn', '멈춤')
  const engineSel = h('select', { 'aria-label': '읽기 엔진', onchange: (e) => store.set('tts.engine', e.target.value) },
    Object.entries(tts.ENGINES).map(([k, v]) => h('option', { value: k, selected: k === store.get('tts.engine') }, v)))

  reader?.stop()
  reader = new tts.Reader({
    onIndex: (i) => {
      view.querySelectorAll('.now').forEach((x) => x.classList.remove('now'))
      const s = view.children[i]
      if (s) {
        s.classList.add('now')
        s.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      status.textContent = `${i + 1} / ${list.length} 문장`
    },
    onEnd: () => (status.textContent = '끝까지 읽었습니다'),
    onError: (e) => {
      status.textContent = ''
      toast(errText(e), 6000)
    }
  })

  function paint() {
    if (!list.length) {
      view.replaceChildren(h('div.empty', h('h2', '읽을 글이 없습니다'), h('p', '아래 칸에 붙여넣거나, 작업대에서 문서를 연 뒤 다시 오세요. AI 결과의 [읽어주기] 단추로도 보낼 수 있습니다.')))
      return
    }
    view.replaceChildren(...list.map((s, i) => h('span.s', { title: '여기부터 읽기', onclick: () => reader.start(list, i) }, s + ' ')))
  }

  rate.addEventListener('input', () => {
    reader.setRate(Number(rate.value))
    rateOut.textContent = `${rate.value}×`
  })
  playBtn.addEventListener('click', () => (list.length ? reader.start(list, 0) : toast('읽을 글이 없습니다')))
  pauseBtn.addEventListener('click', () => {
    if (reader.paused) {
      reader.resume()
      pauseBtn.textContent = '일시정지'
    } else {
      reader.pause()
      pauseBtn.textContent = '이어 읽기'
    }
  })
  stopBtn.addEventListener('click', () => reader.stop())

  const paste = h('textarea', { rows: 4, placeholder: '읽을 글을 붙여넣기 (비워 두면 작업대의 문서를 읽습니다)', 'aria-label': '읽을 글', style: 'width:100%' })
  paste.addEventListener('input', () => {
    text = paste.value || doc.text
    list = tts.sentences(text)
    paint()
  })

  const saveBtn = h('button.btn', {
    onclick: async () => {
      const eng = store.get('tts.engine')
      if (eng === 'browser') return toast('브라우저 내장 음성은 파일로 저장할 수 없습니다. Gemini·OpenAI 엔진을 고르세요.', 5000)
      if (!list.length) return
      if (!confirm(`${list.length}문장을 합성해 파일로 저장합니다. 글자 수만큼 요금이 듭니다(이미 들은 문장은 다시 받지 않음). 계속할까요?`)) return
      try {
        const items = []
        for (let i = 0; i < list.length; i++) {
          status.textContent = `파일 만드는 중 ${i + 1}/${list.length}`
          items.push(await tts.synth(eng, list[i]))
        }
        download(safeName(title) + (eng === 'gemini' ? '.wav' : '.mp3'), tts.joinAudio(eng, items))
        status.textContent = '저장했습니다'
      } catch (e) {
        toast(errText(e), 6000)
      }
    }
  }, '음성 파일로 저장')

  main.replaceChildren(
    h('header.head',
      h('div.grow', h('h1', '읽어주기'), h('p', '문장을 누르면 그 문장부터 읽습니다. 속도를 바꿔도 다시 합성하지 않습니다.')),
      h('div.row', engineSel)
    ),
    h('div.pad',
      h('div.panel',
        h('div.row', playBtn, pauseBtn, stopBtn, h('label.row', '속도', rate, rateOut), saveBtn, status),
        paste
      ),
      h('div.panel', view)
    )
  )
  paint()
  return () => reader?.stop()
}
