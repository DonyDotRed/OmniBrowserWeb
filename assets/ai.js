// AI 3사(Gemini · OpenAI · Claude)를 브라우저에서 직접 호출한다.
// 서버가 없으므로 API 키는 이 브라우저에만 저장되고, 요청은 각 회사로 바로 간다.
import * as store from './store.js'

export const PROVIDERS = {
  gemini: { label: 'Google Gemini', model: 'gemini-3.6-flash', keyUrl: 'https://aistudio.google.com/apikey' },
  openai: { label: 'OpenAI (GPT)', model: 'gpt-5.4-mini', keyUrl: 'https://platform.openai.com/api-keys' },
  anthropic: { label: 'Anthropic Claude', model: 'claude-haiku-4-5-20251001', keyUrl: 'https://console.anthropic.com/settings/keys' }
}
// 자동 시험용 가짜 AI: 주소에 ?test=1 이 있을 때만 나타남
export const TEST_MODE = new URLSearchParams(location.search).has('test')
if (TEST_MODE) PROVIDERS.mock = { label: '시험용 가짜 AI', model: 'mock-1', keyUrl: '' }

export const LANGS = { ko: '한국어', en: '영어', ja: '일본어', zh: '중국어(간체)', de: '독일어', fr: '프랑스어', es: '스페인어' }

export const PRESETS = [
  { id: 'summarize', label: '요약', text: '다음 내용을 {lang}로 요약하세요. 먼저 한 문장 결론, 이어서 핵심 5~7개를 글머리표로. 숫자·고유명사는 정확히 유지하세요.' },
  { id: 'translate', label: '번역', text: '다음 텍스트를 {lang}로 자연스럽고 정확하게 번역하세요. 원문의 문단·목록 구조를 유지하고 번역문만 출력하세요. 전문 용어는 처음 나올 때 괄호 안에 원어를 병기하세요.' },
  { id: 'organize', label: '정리 노트', text: '다음 내용을 {lang} 학습 노트로 정리하세요. Markdown 제목(##)·소제목·글머리표를 쓰고, 비교할 항목이 있으면 표로 만드세요. 마지막에 "핵심 용어" 목록을 붙이세요.' },
  { id: 'keypoints', label: '핵심 3줄', text: '다음 내용의 핵심을 {lang}로 정확히 3줄로 요약하세요.' },
  { id: 'explain', label: '쉽게 설명', text: '다음 내용을 해당 분야를 처음 접하는 사람도 이해하도록 {lang}로 쉽게 설명하세요. 비유와 예시를 하나씩 들어 주세요.' },
  { id: 'glossary', label: '용어 사전', text: '다음 내용에 나오는 전문 용어를 찾아 {lang}로 "용어 | 뜻 | 원어" 표로 정리하세요.' },
  { id: 'quiz', label: '퀴즈', text: '다음 내용으로 이해도 확인용 객관식 문제 5개를 {lang}로 만드세요. 각 문제 아래에 정답과 해설을 붙이세요.' },
  { id: 'proofread', label: '교정', text: '다음 글의 맞춤법·문법·어색한 표현을 교정하세요. 교정된 전체 글을 먼저 보여 주고, 이어서 주요 수정 사항을 "원문 → 수정 (이유)" 목록으로 보여 주세요.' },
  { id: 'action', label: '할 일 추출', text: '다음 내용에서 해야 할 일·마감일·담당자를 찾아 {lang} 체크리스트(- [ ])로 정리하세요. 없으면 없다고 답하세요.' }
]

const SYSTEM =
  '당신은 사용자가 읽고 있는 문서를 다루는 AI 도우미입니다. 주어진 자료에 근거해 답하고, 자료에 없는 내용은 추측이라고 밝히세요. 답은 Markdown으로 작성하세요.'
const SEGMENT_SYSTEM =
  'You are a professional translator. The user sends text segments, each starting with a marker like ⟦12⟧. Translate each segment into {lang}. Output every segment in the same order, each starting with its exact original marker, one per line. Do not merge, split, skip, or explain. Keep numbers, code, URLs and proper nouns accurate.'

export const currentProvider = () => (PROVIDERS[store.get('provider')] ? store.get('provider') : 'gemini')
export const modelOf = (p) => store.get('model.' + p) || autoModel(p) || PROVIDERS[p].model

/** 모델 칸이 비어 있고, 갱신한 목록에 기본 모델이 없으면(단종) 추천 최신 모델 사용 */
function autoModel(p) {
  if (!store.get('autoLatest')) return ''
  const c = store.get('models.chat.' + p)
  if (c && c.models?.length && !c.models.some((m) => m.id === PROVIDERS[p].model) && c.recommended) return c.recommended
  return ''
}

function needKey(p) {
  if (p === 'mock') return ''
  const k = store.getKey(p)
  if (!k) throw new Error(`${PROVIDERS[p].label} API 키가 없습니다. 설정에서 키를 등록하세요.`)
  return k
}

async function fail(p, res) {
  let msg = ''
  try {
    const j = await res.json()
    msg = j.error?.message || j.message || JSON.stringify(j).slice(0, 200)
  } catch {
    msg = res.statusText
  }
  const hint =
    {
      400: '요청 내용이나 모델 이름을 확인하세요.',
      401: 'API 키가 올바른지 확인하세요.',
      403: 'API 키 권한·지역 제한을 확인하세요.',
      404: '모델 이름이 없습니다. 설정 → AI에서 🔄 최신 목록을 받아 고르세요.',
      429: '사용 한도 초과이거나 요청이 너무 잦습니다. 잠시 후 다시 시도하거나 요금제를 확인하세요.'
    }[res.status] || '잠시 후 다시 시도하세요.'
  throw new Error(`${PROVIDERS[p].label} 오류 ${res.status}: ${msg} — ${hint}`)
}

/** Server-Sent Events 읽기 → data: JSON 하나씩 */
async function* sse(res, signal) {
  const reader = res.body.getReader()
  const dec = new TextDecoder()
  let buf = ''
  while (true) {
    if (signal?.aborted) return
    const { done, value } = await reader.read()
    if (done) break
    buf += dec.decode(value, { stream: true })
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (!line.startsWith('data:')) continue
      const data = line.slice(5).trim()
      if (!data || data === '[DONE]') continue
      try {
        yield JSON.parse(data)
      } catch {
        /* 조각난 줄은 무시 */
      }
    }
  }
}

/**
 * 대화 요청 → 글자 조각을 하나씩 돌려준다.
 * messages: [{role:'user'|'assistant', content}]
 */
export async function* streamChat({ provider, model, system, messages, signal }) {
  const p = provider || currentProvider()
  const m = model || modelOf(p)
  const key = needKey(p)
  const chars = (system || '').length + messages.reduce((a, x) => a + x.content.length, 0)
  store.checkBudget(chars)
  let out = 0
  try {
    if (p === 'mock') {
      for await (const piece of mockStream(messages)) {
        out += piece.length
        yield piece
      }
      return
    }
    let res
    if (p === 'openai') {
      res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          model: m,
          stream: true,
          max_completion_tokens: 8000,
          messages: [{ role: 'system', content: system }, ...messages]
        })
      })
    } else if (p === 'anthropic') {
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal,
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
          'anthropic-dangerous-direct-browser-access': 'true' // 브라우저에서 직접 호출 허용 (키는 이 PC에만 있음)
        },
        body: JSON.stringify({ model: m, stream: true, max_tokens: 8000, system, messages })
      })
    } else {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(m)}:streamGenerateContent?alt=sse`, {
        method: 'POST',
        signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: messages.map((x) => ({ role: x.role === 'assistant' ? 'model' : 'user', parts: [{ text: x.content }] })),
          generationConfig: { maxOutputTokens: 8000 }
        })
      })
    }
    if (!res.ok) await fail(p, res)
    for await (const ev of sse(res, signal)) {
      let t = ''
      if (p === 'openai') t = ev.choices?.[0]?.delta?.content || ''
      else if (p === 'anthropic') {
        if (ev.type === 'content_block_delta') t = ev.delta?.text || ''
        if (ev.type === 'error') throw new Error('Claude 오류: ' + ev.error?.message)
      } else t = (ev.candidates?.[0]?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join('')
      if (t) {
        out += t.length
        yield t
      }
    }
  } catch (e) {
    if (e.name === 'TypeError' && /fetch/i.test(e.message))
      throw new Error(`${PROVIDERS[p].label}에 연결하지 못했습니다 (인터넷 연결 또는 회사 방화벽 확인).`)
    throw e
  } finally {
    store.addUsage(p, chars + out)
  }
}

export async function chatText(opts) {
  let s = ''
  for await (const t of streamChat(opts)) s += t
  return s
}

/** 프리셋·질문 → 보낼 메시지 구성 */
export function buildRequest({ preset, question, source, title, history = [] }) {
  const lang = LANGS[store.get('lang')] || '한국어'
  const max = Number(store.get('maxInput')) || 60000
  let text = (source || '').trim()
  let note = ''
  if (text.length > max) {
    text = text.slice(0, max)
    note = `\n\n(자료가 길어 앞부분 ${max.toLocaleString()}자만 사용했습니다.)`
  }
  const material = text ? `[제목] ${title || '(제목 없음)'}\n\n${text}${note}` : ''
  let system = SYSTEM
  const messages = [...history]
  const p = PRESETS.find((x) => x.id === preset)
  if (p) {
    if (!material) throw new Error('처리할 글이 없습니다. 왼쪽에 붙여넣거나 파일을 여세요.')
    messages.push({ role: 'user', content: `${p.text.replaceAll('{lang}', lang)}\n\n---\n${material}` })
  } else {
    if (!question) throw new Error('질문을 입력하세요.')
    if (material) system += `\n\n다음은 사용자가 보고 있는 자료입니다. 이 자료를 근거로 ${lang}로 답하세요.\n<자료>\n${material}\n</자료>`
    messages.push({ role: 'user', content: question })
  }
  return { system, messages }
}

/** 구간 번역: [{id,text}] → {id: 번역} */
export async function translateSegments(segs, signal) {
  const lang = LANGS[store.get('lang')] || '한국어'
  const joined = segs.map((s) => `⟦${s.id}⟧ ${s.text.replace(/\s+/g, ' ')}`).join('\n')
  const out = await chatText({
    system: SEGMENT_SYSTEM.replace('{lang}', lang),
    messages: [{ role: 'user', content: `Translate into ${lang}.\n\n${joined}` }],
    signal
  })
  const res = {}
  for (const m of out.matchAll(/⟦(\d+)⟧\s*([\s\S]*?)(?=\s*⟦\d+⟧|$)/g)) if (m[2].trim()) res[m[1]] = m[2].trim()
  return res
}

// ───────── 모델 목록 (최신 목록 갱신 · 추천) ─────────
const ver = (s) => (s.match(/(\d+(?:\.\d+)*)/)?.[1] || '0').split('.').map(Number)
const cmpVer = (a, b) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) - (b[i] || 0)
  return 0
}
const FAMILY = {
  'gemini/chat': /^gemini-(\d+(?:\.\d+)?)-flash$/,
  'openai/chat': /^gpt-(\d+(?:\.\d+)?)-mini$/,
  'anthropic/chat': /^claude-haiku-/,
  'gemini/tts': /^gemini-(\d+(?:\.\d+)?)-flash(-preview)?-tts(-preview)?$/,
  'openai/tts': /^gpt-.*mini-tts$/
}
export function recommend(p, models, kind = 'chat') {
  const re = FAMILY[`${p}/${kind}`]
  if (!models.length) return null
  if (!re) return models[0].id
  let c = models.filter((m) => re.test(m.id) && !m.id.replace('tts-preview', '').includes('preview'))
  if (!c.length) c = models.filter((m) => re.test(m.id))
  if (!c.length) return null
  c.sort((a, b) => b.created - a.created || cmpVer(ver(b.id), ver(a.id)))
  return c[0].id
}

export async function listModels(p, kind = 'chat') {
  if (p === 'mock') return [{ id: 'mock-1', name: 'Mock', created: 0 }]
  const key = needKey(p)
  let res
  const out = []
  if (p === 'openai') {
    res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: 'Bearer ' + key } })
    if (!res.ok) await fail(p, res)
    const skip = /embedding|whisper|dall-e|image|audio|realtime|moderation|transcribe|search|davinci|babbage|codex/
    for (const m of (await res.json()).data || []) {
      const tts = m.id.includes('tts')
      if (kind === 'tts' ? !tts : !/^(gpt|o\d|chatgpt)/.test(m.id) || tts || skip.test(m.id)) continue
      out.push({ id: m.id, name: m.id, created: m.created || 0 })
    }
  } else if (p === 'anthropic') {
    if (kind === 'tts') return []
    res = await fetch('https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
    })
    if (!res.ok) await fail(p, res)
    for (const m of (await res.json()).data || [])
      out.push({ id: m.id, name: m.display_name || m.id, created: Date.parse(m.created_at) / 1000 || 0 })
  } else {
    res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=500', { headers: { 'x-goog-api-key': key } })
    if (!res.ok) await fail(p, res)
    for (const m of (await res.json()).models || []) {
      if (!(m.supportedGenerationMethods || []).includes('generateContent')) continue
      const id = m.name.replace(/^models\//, '')
      const tts = id.includes('tts')
      if ((kind === 'tts') !== tts || (kind === 'chat' && /image|embedding|aqa|live/.test(id))) continue
      out.push({ id, name: m.displayName || id, created: 0 })
    }
  }
  out.sort((a, b) => b.created - a.created || cmpVer(ver(b.id), ver(a.id)) || a.id.localeCompare(b.id))
  return out
}

/** 목록 받기 (저장해 두고 재사용, refresh면 새로 받음) */
export async function modelsFor(p, kind = 'chat', refresh = false) {
  const key = `models.${kind}.${p}`
  const cached = store.get(key)
  if (cached && !refresh) return cached
  const models = await listModels(p, kind)
  const data = { updated: Date.now(), models, recommended: recommend(p, models, kind) }
  store.set(key, data)
  return data
}

/** 앱을 열 때: 하루 지난 목록만 조용히 갱신 */
export async function autoRefreshModels() {
  if (!store.get('modelsAutoRefresh')) return
  for (const p of ['gemini', 'openai', 'anthropic']) {
    if (!store.getKey(p)) continue
    for (const kind of p === 'anthropic' ? ['chat'] : ['chat', 'tts']) {
      const c = store.get(`models.${kind}.${p}`)
      if (c && Date.now() - c.updated < 86400000) continue
      try {
        await modelsFor(p, kind, true)
      } catch {
        /* 네트워크 오류는 다음에 다시 */
      }
    }
  }
}

// ───────── 시험용 가짜 AI ─────────
async function* mockStream(messages) {
  const text = messages[messages.length - 1].content
  const wait = () => new Promise((r) => setTimeout(r, 15))
  if (text.includes('⟦')) {
    for (const m of text.split('\n\n').slice(1).join('\n\n').matchAll(/⟦(\d+)⟧\s*([^⟦]*)/g)) {
      await wait()
      yield `⟦${m[1]}⟧ [번역] ${m[2].trim()}\n`
    }
    return
  }
  const reply = `## 시험 응답\n\n- 받은 글자 수: ${text.length}\n- 첫 부분: ${text.slice(0, 80).replace(/\n/g, ' ')}\n\n| 항목 | 값 |\n|---|---|\n| 상태 | 정상 |`
  for (let i = 0; i < reply.length; i += 8) {
    await wait()
    yield reply.slice(i, i + 8)
  }
}
