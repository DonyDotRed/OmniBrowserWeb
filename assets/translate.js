// 문서 번역: 긴 글을 문단 단위로 나눠 차례로 번역하고 원문과 나란히 보여 준다
import * as ai from './ai.js'
import { doc } from './state.js'
import * as store from './store.js'
import { download, errText, fmt, h, safeName, toast } from './ui.js'

let painter = () => {}
let job = null // {rows:[{id,src,dst}], done, total, ctrl, error}

function split(text) {
  // 빈 줄 기준 문단, 너무 긴 문단(1500자 초과)은 문장 단위로 다시 나눔
  const paras = text.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  const out = []
  for (const p of paras) {
    if (p.length <= 1500) out.push(p)
    else {
      let cur = ''
      for (const s of p.split(/(?<=[.!?。？！])\s+/)) {
        if ((cur + ' ' + s).length > 1500 && cur) {
          out.push(cur)
          cur = s
        } else cur = cur ? cur + ' ' + s : s
      }
      if (cur) out.push(cur)
    }
  }
  return out
}

export function renderTranslate(main) {
  const table = h('table.bitext')
  const bar = h('i')
  const status = h('span.hint')
  const startBtn = h('button.run', { type: 'button', html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z"/></svg><span>번역 시작</span>' })
  const stopBtn = h('button.btn', { disabled: true }, '중지')
  const langSel = h('select', { 'aria-label': '번역할 언어', onchange: (e) => store.set('lang', e.target.value) },
    Object.entries(ai.LANGS).map(([k, v]) => h('option', { value: k, selected: k === store.get('lang') }, v + '로')))

  function paint() {
    if (!job) {
      table.replaceChildren(h('tr', h('td', { colspan: 2 }, h('div.empty',
        h('h2', doc.text ? `"${doc.title || '작업대의 문서'}" ${fmt(doc.text.length)}자` : '번역할 문서가 없습니다'),
        h('p', doc.text
          ? '문단으로 나눠 차례로 번역하고 원문과 나란히 보여 줍니다. 수십 쪽짜리 문서도 끝까지 번역하며, 결과는 대역(원문+번역) 또는 번역문만 저장할 수 있습니다.'
          : '작업대에 글을 넣거나 파일을 연 뒤 이 화면으로 오세요.'),
        doc.text ? null : h('a.btn', { href: '#/' }, '작업대로 가기')
      ))))
      return
    }
    table.replaceChildren(...job.rows.map((r) =>
      h('tr', { class: r.dst ? '' : 'pending' }, h('td', r.src), h('td', r.dst || (job.running ? '…' : '(번역 안 됨)')))))
    bar.style.width = `${(job.done / job.total) * 100}%`
    status.textContent = job.error ? job.error : `${job.done}/${job.total} 문단${job.running ? ' 번역 중' : ' 완료'}`
  }

  async function start() {
    if (!doc.text.trim()) return toast('번역할 문서가 없습니다. 작업대에 글을 넣으세요.')
    const parts = split(doc.text)
    job = { rows: parts.map((src, i) => ({ id: i + 1, src, dst: '' })), done: 0, total: parts.length, ctrl: new AbortController(), running: true, error: '' }
    startBtn.disabled = true
    stopBtn.disabled = false
    paint()
    // 40문단·3500자 이하로 묶어 2개씩 동시에 요청
    const batches = []
    let cur = []
    let chars = 0
    for (const r of job.rows) {
      if (cur.length >= 40 || (chars + r.src.length > 3500 && cur.length)) {
        batches.push(cur)
        cur = []
        chars = 0
      }
      cur.push(r)
      chars += r.src.length
    }
    if (cur.length) batches.push(cur)
    const queue = [...batches]
    const worker = async () => {
      for (let b = queue.shift(); b && !job.ctrl.signal.aborted && !job.error; b = queue.shift()) {
        try {
          const res = await ai.translateSegments(b.map((r) => ({ id: r.id, text: r.src })), job.ctrl.signal)
          for (const r of b) r.dst = res[r.id] || ''
        } catch (e) {
          if (!job.ctrl.signal.aborted) job.error = errText(e)
        }
        job.done += b.length
        painter()
      }
    }
    await Promise.all([worker(), worker()])
    job.running = false
    if (job.ctrl.signal.aborted) job.error = '중지했습니다. 번역된 부분까지 저장할 수 있습니다.'
    startBtn.disabled = false
    stopBtn.disabled = true
    paint()
  }
  painter = paint
  startBtn.addEventListener('click', start)
  stopBtn.addEventListener('click', () => job?.ctrl.abort())

  const save = (mode) => {
    if (!job) return toast('먼저 번역하세요.')
    const name = safeName(doc.title || '문서') + (mode === 'bi' ? '_대역.md' : '_번역.md')
    const body = mode === 'bi'
      ? job.rows.map((r) => `> ${r.src.replace(/\n/g, '\n> ')}\n\n${r.dst}\n`).join('\n')
      : job.rows.map((r) => r.dst).join('\n\n')
    download(name, `# ${doc.title || '번역'}\n\n${body}`)
  }

  main.replaceChildren(
    h('header.head',
      h('div.grow', h('h1', '문서 번역'), h('p', '작업대의 문서를 처음부터 끝까지 번역해 원문과 나란히 보여 줍니다.')),
      h('div.row', langSel, startBtn, stopBtn)
    ),
    h('div.pad',
      h('div.row', h('div.progress', bar), status,
        h('button.btn', { onclick: () => save('bi') }, '대역 저장 (.md)'),
        h('button.btn', { onclick: () => save('dst') }, '번역문만 저장')),
      h('div.panel', { style: 'padding:0;overflow:hidden' }, h('div.table-wrap', table))
    )
  )
  paint()
}
