// 메모: AI 결과·생각을 이 브라우저에 저장. Markdown 지원, 검색, 내보내기
import * as store from './store.js'
import { download, h, md, newTabLinks, toast } from './ui.js'

const all = () => store.get('notes') || []
const save = (list) => store.set('notes', list)

export function addNote({ title, body, url }) {
  const list = all()
  list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), title: title || '제목 없음', body: body || '', url: url || '', created: Date.now(), updated: Date.now() })
  save(list)
  return list[0].id
}

let selected = null

export function renderNotes(main) {
  const q = h('input', { type: 'search', placeholder: '메모 검색', 'aria-label': '메모 검색', style: 'width:100%' })
  const listEl = h('ul.note-list')
  const editor = h('div')

  function paintList() {
    const k = q.value.trim().toLowerCase()
    const items = all().filter((n) => !k || (n.title + n.body).toLowerCase().includes(k))
    if (!items.length) {
      listEl.replaceChildren(h('li.hint', { style: 'padding:12px 4px' }, k ? '찾는 메모가 없습니다.' : '아직 메모가 없습니다. 작업대 결과의 [메모로 저장]이나 위의 [새 메모]로 시작하세요.'))
      return
    }
    listEl.replaceChildren(...items.map((n) =>
      h('li', h('button', { 'aria-current': n.id === selected ? 'true' : 'false', onclick: () => ((selected = n.id), paintList(), paintEditor()) },
        h('span.t', n.title), h('span.d', new Date(n.updated).toLocaleString())))))
  }

  function paintEditor() {
    const n = all().find((x) => x.id === selected)
    if (!n) {
      editor.replaceChildren(h('div.panel', h('div.empty', h('h2', '메모를 고르세요'), h('p', '왼쪽 목록에서 메모를 고르면 여기서 읽고 고칠 수 있습니다.'))))
      return
    }
    const title = h('input', { type: 'text', value: n.title, 'aria-label': '메모 제목', style: 'flex:1;font-weight:650' })
    const body = h('textarea', { rows: 14, value: n.body, 'aria-label': '메모 내용 (Markdown)', style: 'width:100%' })
    const view = h('div.reading')
    let mode = 'view'
    const preview = () => {
      view.innerHTML = md(body.value)
      newTabLinks(view)
    }
    const toggle = h('button.btn', '고치기')
    const paintMode = () => {
      body.hidden = mode === 'view'
      view.hidden = mode !== 'view'
      toggle.textContent = mode === 'view' ? '고치기' : '보기'
      if (mode === 'view') preview()
    }
    toggle.addEventListener('click', () => ((mode = mode === 'view' ? 'edit' : 'view'), paintMode()))
    const persist = () => {
      const list = all()
      const x = list.find((y) => y.id === n.id)
      if (!x) return
      x.title = title.value
      x.body = body.value
      x.updated = Date.now()
      save(list)
      paintList()
    }
    title.addEventListener('change', persist)
    body.addEventListener('change', persist)
    editor.replaceChildren(h('div.panel',
      h('div.row', title, toggle,
        h('button.btn.quiet', { onclick: () => download((n.title || '메모').slice(0, 60) + '.md', `# ${title.value}\n\n${body.value}\n`) }, '.md 저장'),
        h('button.btn.quiet', {
          onclick: () => {
            if (!confirm('이 메모를 삭제할까요?')) return
            save(all().filter((x) => x.id !== n.id))
            selected = null
            paintList()
            paintEditor()
          }
        }, '삭제')),
      n.url ? h('p.hint', '출처: ', h('a', { href: n.url, target: '_blank', rel: 'noopener noreferrer' }, n.url)) : null,
      body, view))
    paintMode()
  }

  q.addEventListener('input', paintList)
  const imp = h('input', { type: 'file', accept: '.json', hidden: true })
  imp.addEventListener('change', async () => {
    try {
      const data = JSON.parse(await imp.files[0].text())
      if (!Array.isArray(data)) throw new Error()
      const ids = new Set(all().map((x) => x.id))
      const merged = [...data.filter((x) => x && x.id && !ids.has(x.id)), ...all()]
      save(merged)
      toast(`메모 ${merged.length - ids.size}개를 가져왔습니다`)
      paintList()
    } catch {
      toast('메모 백업(JSON) 파일이 아닙니다')
    }
  })

  main.replaceChildren(
    h('header.head', h('div.grow', h('h1', '메모'), h('p', '이 브라우저에만 저장됩니다. 다른 PC로 옮기려면 내보내기 파일을 쓰세요.')),
      h('div.row',
        h('button.btn.primary', { onclick: () => ((selected = addNote({ title: '새 메모', body: '' })), paintList(), paintEditor()) }, '새 메모'),
        h('button.btn', {
          onclick: () => {
            const text = all().map((n) => `## ${n.title}\n\n${n.url ? `출처: ${n.url}\n\n` : ''}${n.body}\n`).join('\n---\n\n')
            download('OmniBrowser_메모.md', `# OmniBrowser Web 메모\n\n${text}`)
          }
        }, '모두 .md로'),
        h('button.btn', { onclick: () => download('OmniBrowser_메모_백업.json', JSON.stringify(all(), null, 2), 'application/json') }, '백업(JSON)'),
        h('button.btn', { onclick: () => imp.click() }, '가져오기'), imp)),
    h('div.notes', h('div.panel', { style: 'padding:12px' }, q, listEl), editor)
  )
  paintList()
  paintEditor()
}
