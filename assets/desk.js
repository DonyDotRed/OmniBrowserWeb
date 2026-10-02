// 작업대: 문서 넣기(붙여넣기·파일·주소·북마크릿) → AI 요약·번역·정리·질문
import * as ai from './ai.js'
import { ACCEPT, readFile, readUrl } from './files.js'
import { doc, listenQueue, saveDoc, setDoc, thread } from './state.js'
import * as store from './store.js'
import { copy, download, errText, fmt, h, md, newTabLinks, safeName, toast } from './ui.js'
import { addNote } from './notes.js'

const SPARK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1l2.6 8.4L23 12l-8.4 2.6L12 23l-2.6-8.4L1 12l8.4-2.6z"/></svg>'

export function renderDesk(main) {
  const title = h('input', { type: 'text', value: doc.title, placeholder: '문서 제목 (선택)', 'aria-label': '문서 제목', style: 'flex:1;min-width:120px' })
  const area = h('textarea', {
    placeholder: '여기에 글을 붙여넣거나, 파일(PDF·DOCX·TXT·MD·HTML·자막)을 끌어다 놓으세요.\n웹 페이지는 "북마크릿" 메뉴의 [AI로 보내기]를 쓰면 로그인한 페이지도 그대로 가져옵니다.',
    'aria-label': '문서 내용',
    value: doc.text
  })
  const meta = h('div.meta')
  const fileIn = h('input', { type: 'file', accept: ACCEPT, hidden: true })
  const updateMeta = () => {
    const sel = area.selectionEnd - area.selectionStart
    meta.replaceChildren(
      ...[
        h('span', `${fmt(area.value.length)}자`),
        sel > 0 ? h('span', `선택한 ${fmt(sel)}자만 처리합니다`) : null,
        doc.url ? h('a', { href: doc.url, target: '_blank', rel: 'noopener noreferrer' }, '원본 열기') : null
      ].filter(Boolean)
    )
  }
  area.addEventListener('input', () => {
    doc.text = area.value
    saveDoc()
    updateMeta()
  })
  area.addEventListener('select', updateMeta)
  area.addEventListener('keyup', updateMeta)
  title.addEventListener('input', () => {
    doc.title = title.value
    saveDoc()
  })

  const load = async (fn, label) => {
    meta.replaceChildren(h('span', `${label} 읽는 중…`))
    try {
      const d = await fn()
      setDoc(d)
      area.value = doc.text
      title.value = doc.title
      toast(`${label}: ${fmt(doc.text.length)}자를 가져왔습니다`)
    } catch (e) {
      toast(errText(e), 6000)
    }
    updateMeta()
  }
  fileIn.addEventListener('change', () => fileIn.files[0] && load(() => readFile(fileIn.files[0]), fileIn.files[0].name))
  const zone = h('div.source.dropzone', area)
  zone.addEventListener('dragover', (e) => {
    e.preventDefault()
    zone.classList.add('drag')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('drag'))
  zone.addEventListener('drop', (e) => {
    zone.classList.remove('drag')
    const f = e.dataTransfer.files[0]
    if (f) {
      e.preventDefault()
      load(() => readFile(f), f.name)
    }
  })

  const urlBtn = store.get('urlReader')
    ? h('button.btn', {
        onclick: () => {
          const u = prompt('가져올 웹 주소 (외부 서비스 r.jina.ai를 거쳐 본문을 받습니다)')
          if (u) load(() => readUrl(u.trim()), '웹 주소')
        }
      }, '주소에서 가져오기')
    : null

  // ───── 결과 쪽 ─────
  const list = h('div.thread', { 'aria-live': 'polite' })
  const ask = h('textarea', { rows: 2, placeholder: '문서에 대해 묻기 (Enter 보내기, Shift+Enter 줄바꿈)', 'aria-label': '질문' })
  const withDoc = h('input', { type: 'checkbox', checked: true, id: 'withdoc' })
  const sendBtn = h('button.run', { type: 'button', html: SPARK + '<span>물어보기</span>' })

  const sourceText = () => {
    const s = area.selectionStart
    const e = area.selectionEnd
    return e > s ? area.value.slice(s, e) : area.value
  }

  const providerSel = h(
    'select',
    { 'aria-label': 'AI 선택', onchange: (e) => (store.set('provider', e.target.value), paintModel()) },
    Object.entries(ai.PROVIDERS).map(([k, v]) => h('option', { value: k, selected: k === ai.currentProvider() }, v.label + (store.getKey(k) || k === 'mock' ? '' : ' (키 없음)')))
  )
  const modelTag = h('span.hint')
  const paintModel = () => (modelTag.textContent = ai.modelOf(ai.currentProvider()))
  paintModel()
  const langSel = h(
    'select',
    { 'aria-label': '결과 언어', onchange: (e) => store.set('lang', e.target.value) },
    Object.entries(ai.LANGS).map(([k, v]) => h('option', { value: k, selected: k === store.get('lang') }, '결과: ' + v))
  )

  function paint() {
    if (!thread.length) {
      list.replaceChildren(
        h('div.empty',
          h('h2', '무엇을 할까요?'),
          h('ol',
            h('li', '왼쪽에 글을 넣습니다 — 붙여넣기, 파일 끌어다 놓기, 또는 다른 사이트에서 북마크릿 [AI로 보내기].'),
            h('li', '아래 단추로 요약·번역·정리를 고릅니다. 일부만 하려면 그 부분을 드래그해 선택하세요.'),
            h('li', '결과를 보고 이어서 질문합니다. 결과는 메모·Markdown 파일로 남길 수 있습니다.')
          ),
          store.getKey(ai.currentProvider()) || ai.currentProvider() === 'mock'
            ? null
            : h('p', h('a', { href: '#/settings' }, `${ai.PROVIDERS[ai.currentProvider()].label} API 키 등록하기`), ' — 키는 이 브라우저에만 저장됩니다.')
        )
      )
      return
    }
    list.replaceChildren(...thread.map(turnView))
    list.scrollTop = list.scrollHeight
  }

  function turnView(t) {
    const body = h('div.reading', { html: md(t.answer) })
    newTabLinks(body)
    if (t.streaming) body.append(h('span.caret', { 'aria-hidden': 'true' }))
    const acts = t.streaming
      ? [h('button.btn.quiet', { onclick: () => t.ctrl.abort() }, '중지')]
      : t.answer
        ? [
            h('button.btn.quiet', { onclick: () => copy(t.answer) }, '복사'),
            h('button.btn.quiet', { onclick: () => (addNote({ title: `${t.label} — ${doc.title || '문서'}`, body: t.answer, url: doc.url }), toast('메모에 저장했습니다')) }, '메모로 저장'),
            h('button.btn.quiet', { onclick: () => download(safeName(`${doc.title || '문서'}_${t.label}`) + '.md', `# ${t.label}\n\n${t.answer}\n`) }, '.md 저장'),
            h('button.btn.quiet', { onclick: () => (Object.assign(listenQueue, { text: t.answer.replace(/[#*`>|_]+/g, ' '), title: t.label }), (location.hash = '#/listen')) }, '읽어주기')
          ]
        : []
    return h('section.turn',
      h('div.ask', h('b', t.label), t.question ? h('span', t.question) : null),
      body,
      t.error ? h('div.err', t.error) : null,
      h('div.actions', acts)
    )
  }

  async function run({ preset, question }) {
    const p = ai.PRESETS.find((x) => x.id === preset)
    const src = preset || withDoc.checked ? sourceText() : ''
    const t = { label: p ? p.label : '질문', question, answer: '', streaming: true, error: '', ctrl: new AbortController() }
    let req
    try {
      const history = preset ? [] : thread.filter((x) => x.answer && !x.error).slice(-5).flatMap((x) => [
        { role: 'user', content: x.question || x.label },
        { role: 'assistant', content: x.answer }
      ])
      req = ai.buildRequest({ preset, question, source: src, title: doc.title, history })
    } catch (e) {
      toast(errText(e), 4000)
      return
    }
    thread.push(t)
    paint()
    let last = 0
    try {
      for await (const piece of ai.streamChat({ ...req, signal: t.ctrl.signal })) {
        t.answer += piece
        if (Date.now() - last > 80) {
          last = Date.now()
          paint()
        }
      }
    } catch (e) {
      t.error = t.ctrl.signal.aborted ? '중지했습니다.' : errText(e)
    }
    t.streaming = false
    paint()
  }

  const presetBtns = ai.PRESETS.map((p) => h('button.chip', { type: 'button', onclick: () => run({ preset: p.id }) }, p.label))
  const send = () => {
    const q = ask.value.trim()
    if (!q) return
    ask.value = ''
    run({ question: q })
  }
  sendBtn.addEventListener('click', send)
  ask.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      send()
    }
  })

  main.replaceChildren(
    h('header.head',
      h('div.grow', h('h1', '작업대'), h('p', '글을 넣고 요약·번역·정리를 고르세요. 결과에 대해 이어서 질문할 수 있습니다.')),
      h('div.row', providerSel, modelTag, langSel)
    ),
    h('div.desk',
      h('section.pane.in', { 'aria-label': '문서' },
        h('div.pane-bar', title, h('button.btn', { onclick: () => fileIn.click() }, '파일 열기'), urlBtn,
          h('button.btn.quiet', { onclick: () => { setDoc({}); area.value = ''; title.value = ''; updateMeta() } }, '비우기'), fileIn),
        zone,
        meta,
        h('div.presets', { role: 'group', 'aria-label': '한 번에 실행' }, presetBtns)
      ),
      h('section.pane.out', { 'aria-label': 'AI 결과' },
        h('div.pane-bar', h('span.title', '결과'), h('button.btn.quiet', { onclick: () => { thread.length = 0; paint() } }, '대화 지우기')),
        list,
        h('div.followup',
          h('div', { style: 'flex:1;display:flex;flex-direction:column;gap:4px' }, ask,
            h('label.hint', withDoc, ' 문서 내용을 함께 보내기')),
          sendBtn
        )
      )
    )
  )
  updateMeta()
  paint()

  // 북마크릿이 보낸 페이지가 있으면 받아서 넣고, 요청한 작업 실행
  const onDoc = () => {
    area.value = doc.text
    title.value = doc.title
    updateMeta()
  }
  window.addEventListener('omni:doc', onDoc)
  const onRun = (e) => run({ preset: e.detail })
  window.addEventListener('omni:run', onRun)
  return () => {
    window.removeEventListener('omni:doc', onDoc)
    window.removeEventListener('omni:run', onRun)
  }
}
