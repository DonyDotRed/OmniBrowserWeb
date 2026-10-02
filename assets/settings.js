// 설정: AI 키·모델, 읽어주기, 화면, 데이터 백업
import * as ai from './ai.js'
import * as store from './store.js'
import * as tts from './tts.js'
import { download, errText, fmt, h, toast } from './ui.js'

/** 모델 고르기 + 🔄 최신 목록 + ⭐ 추천 */
function modelPicker(p, kind, settingKey, defaultModel) {
  const box = h('div')
  const info = h('div.hint')
  async function paint(refresh) {
    const hasKey = !!store.getKey(p) || p === 'mock'
    let data = store.get(`models.${kind}.${p}`)
    if (refresh) {
      info.textContent = '최신 목록 받는 중…'
      try {
        data = await ai.modelsFor(p, kind, true)
        toast(`${ai.PROVIDERS[p].label}: 모델 ${data.models.length}개`)
      } catch (e) {
        info.textContent = errText(e)
        return
      }
    }
    const cur = store.get(settingKey) || ''
    const ids = new Set((data?.models || []).map((m) => m.id))
    const sel = h('select', { 'aria-label': `${ai.PROVIDERS[p].label} 모델`, disabled: !hasKey, style: 'flex:1;min-width:0' })
    const replaced = kind === 'chat' && store.get('autoLatest') && data?.models?.length && !ids.has(defaultModel) && data.recommended
    sel.append(h('option', { value: '' }, replaced ? `기본값 → ${data.recommended} (기본 모델이 목록에 없어 자동 대체)` : `기본값 (${defaultModel})`))
    if (data?.recommended) sel.append(h('option', { value: data.recommended }, `⭐ ${data.recommended} (추천 최신)`))
    for (const m of data?.models || []) if (m.id !== data.recommended) sel.append(h('option', { value: m.id }, m.name && m.name !== m.id ? `${m.id} — ${m.name}` : m.id))
    if (cur && !ids.has(cur)) sel.append(h('option', { value: cur }, `${cur} (직접 입력)`))
    sel.append(h('option', { value: '__manual' }, '✏ 직접 입력…'))
    sel.value = cur
    sel.addEventListener('change', () => {
      let v = sel.value
      if (v === '__manual') {
        v = (prompt('모델 이름을 입력하세요', cur) || '').trim()
        if (!v) return (sel.value = cur)
      }
      store.set(settingKey, v)
      paint(false)
    })
    box.replaceChildren(h('div.row', { style: 'margin:0' }, sel, h('button.btn', { disabled: !hasKey, title: '각 회사에서 최신 모델 목록을 다시 받습니다', onclick: () => paint(true) }, '🔄 최신 목록')), info)
    info.textContent = !hasKey ? '키를 등록하면 목록을 받을 수 있습니다.' : data ? `목록 ${data.models.length}개 · ${new Date(data.updated).toLocaleString()} 갱신` : '🔄을 눌러 최신 목록을 받으세요.'
  }
  paint(false)
  return box
}

export function renderSettings(main) {
  const section = (title, lead, ...body) => h('section.panel', h('h2', title), lead ? h('p.lead', lead) : null, ...body)
  const field = (label, control, hint) => [h('label', label), h('div', control, hint ? h('div.hint', hint) : null)]
  const num = (key, attrs) => {
    const i = h('input', { type: 'number', value: store.get(key), ...attrs })
    i.addEventListener('change', () => store.set(key, Number(i.value)))
    return i
  }
  const check = (key, label) => {
    const c = h('input', { type: 'checkbox', checked: store.get(key) })
    c.addEventListener('change', () => store.set(key, c.checked))
    return h('label.row', { style: 'margin:0' }, c, label)
  }
  const select = (key, opts) => {
    const s = h('select', {}, Object.entries(opts).map(([v, l]) => h('option', { value: v, selected: String(store.get(key)) === v }, l)))
    s.addEventListener('change', () => store.set(key, s.value))
    return s
  }

  // ── AI ──
  const keyRows = Object.entries(ai.PROVIDERS).filter(([p]) => p !== 'mock').map(([p, info]) => {
    const input = h('input', { type: 'password', placeholder: store.getKey(p) ? '등록됨 — 바꾸려면 새 키 입력' : 'API 키 붙여넣기', autocomplete: 'off', style: 'flex:1;min-width:180px' })
    const status = h('span.hint', store.getKey(p) ? '✓ 등록됨' : '키 없음')
    return h('div', { style: 'border-top:1px solid var(--line);padding:12px 0' },
      h('div.row', { style: 'margin:0 0 6px' }, h('b', info.label), status, h('a', { href: info.keyUrl, target: '_blank', rel: 'noopener noreferrer', style: 'margin-left:auto' }, '키 발급 페이지')),
      h('div.row', { style: 'margin:0 0 6px' }, input,
        h('button.btn.primary', { onclick: () => { if (!input.value.trim()) return; store.setKey(p, input.value); toast(`${info.label} 키를 저장했습니다`); renderSettings(main) } }, '저장'),
        store.getKey(p) ? h('button.btn', { onclick: () => { if (confirm('키를 삭제할까요?')) { store.setKey(p, ''); renderSettings(main) } } }, '삭제') : null),
      modelPicker(p, 'chat', 'model.' + p, info.model))
  })
  const u = store.usage()
  const usageText = Object.entries(u.by).map(([p, n]) => `${p} ${fmt(n)}자`).join(', ') || '없음'

  // ── 읽어주기 ──
  const browserVoice = h('select', { 'aria-label': '브라우저 음성' }, h('option', { value: '' }, '자동 (언어에 맞게)'))
  tts.browserVoices().then((vs) => {
    for (const v of vs.filter((x) => /^(ko|en)/.test(x.lang))) browserVoice.append(h('option', { value: v.name, selected: v.name === store.get('tts.voice.browser') }, `${v.name} (${v.lang})`))
  })
  browserVoice.addEventListener('change', () => store.set('tts.voice.browser', browserVoice.value))
  const style = h('input', { type: 'text', value: store.get('tts.gemini.style'), placeholder: '예: 차분하고 또박또박, 뉴스 앵커처럼', style: 'width:100%' })
  style.addEventListener('change', () => store.set('tts.gemini.style', style.value.trim()))

  // ── 데이터 ──
  const withKeys = h('input', { type: 'checkbox' })
  const restore = h('input', { type: 'file', accept: '.json', hidden: true })
  restore.addEventListener('change', async () => {
    try {
      const n = store.importAll(JSON.parse(await restore.files[0].text()))
      toast(`${n}개 항목을 복원했습니다`)
      setTimeout(() => location.reload(), 800)
    } catch (e) {
      toast(errText(e), 5000)
    }
  })

  main.replaceChildren(
    h('header.head', h('div.grow', h('h1', '설정'), h('p', '모든 설정과 API 키는 이 브라우저에만 저장됩니다. 서버가 없어 어디로도 보내지 않습니다.'))),
    h('div.pad',
      section('AI', '쓸 회사의 키를 등록하세요. 하나만 있어도 됩니다. 요청은 이 브라우저에서 각 회사로 바로 갑니다.',
        h('div.form', field('기본 AI', select('provider', Object.fromEntries(Object.entries(ai.PROVIDERS).map(([k, v]) => [k, v.label]))))),
        keyRows,
        h('div', { style: 'border-top:1px solid var(--line);padding-top:12px' },
          h('div.form',
            ...field('결과 언어', select('lang', ai.LANGS)),
            ...field('모델 목록', h('div',
              h('button.btn', {
                onclick: async () => {
                  let n = 0
                  for (const p of ['gemini', 'openai', 'anthropic']) {
                    if (!store.getKey(p)) continue
                    for (const kind of p === 'anthropic' ? ['chat'] : ['chat', 'tts'])
                      try {
                        await ai.modelsFor(p, kind, true)
                        n++
                      } catch (e) {
                        toast(errText(e), 5000)
                      }
                  }
                  toast(n ? '모든 AI·TTS 모델 목록을 갱신했습니다' : '키가 등록된 AI가 없습니다')
                  renderSettings(main)
                }
              }, '🔄 모든 AI·TTS 목록 지금 갱신'),
              check('modelsAutoRefresh', '하루 한 번 자동 갱신'),
              check('autoLatest', '기본 모델이 단종되면 ⭐ 추천 최신 모델로 자동 대체'))),
            ...field('월 사용 한도 (글자)', num('monthlyLimit', { min: 0, step: 100000 }), `이번 달 사용: ${usageText} · 0이면 무제한`),
            ...field('한 번에 보낼 최대 글자', num('maxInput', { min: 1000, step: 1000 }), '긴 문서는 앞부분만 보냅니다. 끝까지 번역하려면 "문서 번역"을 쓰세요.')
          ))
      ),
      section('읽어주기', '브라우저 내장 음성은 무료이고 설치가 필요 없습니다(음성 종류는 Windows·Chrome·Edge마다 다름). Gemini·OpenAI는 더 자연스럽지만 글자 수만큼 요금이 듭니다.',
        h('div.form',
          ...field('엔진', select('tts.engine', tts.ENGINES)),
          ...field('브라우저 음성', browserVoice, 'Edge는 한국어 "Natural" 음성이 특히 자연스럽습니다.'),
          ...field('Gemini 음성', select('tts.voice.gemini', Object.fromEntries(tts.GEMINI_VOICES.map((v) => [v, v])))),
          ...field('Gemini TTS 모델', modelPicker('gemini', 'tts', 'tts.gemini.model', store.DEFAULTS['tts.gemini.model'])),
          ...field('Gemini 말투 지시', style, '선택 사항. 읽는 방식을 자연어로 지시합니다.'),
          ...field('OpenAI 음성', select('tts.voice.openai', Object.fromEntries(tts.OPENAI_VOICES.map((v) => [v, v])))),
          ...field('OpenAI TTS 모델', modelPicker('openai', 'tts', 'tts.openai.model', store.DEFAULTS['tts.openai.model'])),
          ...field('들어 보기', h('button.btn', {
            onclick: async () => {
              const eng = store.get('tts.engine')
              const sample = '안녕하세요. 옴니브라우저 웹 읽어주기 시험입니다.'
              try {
                if (eng === 'browser') {
                  const u = new SpeechSynthesisUtterance(sample)
                  u.lang = 'ko-KR'
                  const v = (await tts.browserVoices()).find((x) => x.name === store.get('tts.voice.browser'))
                  if (v) u.voice = v
                  speechSynthesis.speak(u)
                } else new Audio(URL.createObjectURL((await tts.synth(eng, sample)).blob)).play()
              } catch (e) {
                toast(errText(e), 5000)
              }
            }
          }, '▶ 지금 엔진으로 들어 보기'))
        )
      ),
      section('영상 · 화면', null,
        h('div.form',
          ...field('즐겨찾기 배속 (G 키)', num('favoriteRate', { min: 0.1, max: 10, step: 0.25 })),
          ...field('화면 색', select('theme', { system: 'Windows 설정 따르기', light: '밝게', dark: '어둡게' }))
        )
      ),
      section('웹 주소에서 가져오기', '작업대에 [주소에서 가져오기] 단추를 표시합니다. 서버가 없는 웹판은 다른 사이트를 직접 읽을 수 없어, 외부 무료 서비스(r.jina.ai)가 그 주소를 대신 읽어 줍니다. 그 서비스가 주소와 내용을 보게 되므로 공개된 페이지에만 쓰세요. 로그인한 페이지는 북마크릿 [AI로 보내기]가 더 안전합니다.',
        check('urlReader', '외부 서비스로 웹 주소 본문 가져오기 사용')
      ),
      section('데이터', '메모·설정을 파일로 백업하거나 다른 PC·브라우저로 옮깁니다.',
        h('div.row',
          h('button.btn', { onclick: () => download(`OmniBrowserWeb_백업_${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(store.exportAll(withKeys.checked), null, 1), 'application/json') }, '백업 파일 받기'),
          h('label.row', { style: 'margin:0' }, withKeys, 'API 키도 포함 (파일 보관 주의)'),
          h('button.btn', { onclick: () => restore.click() }, '백업에서 복원'), restore,
          h('button.btn', { style: 'margin-left:auto;color:var(--danger)', onclick: () => { if (confirm('메모·설정·API 키를 모두 지웁니다. 되돌릴 수 없습니다. 계속할까요?')) { store.resetAll(); location.reload() } } }, '모두 지우기'))
      )
    )
  )
}
