// 저장소: 모든 데이터는 이 브라우저(localStorage)에만 저장된다. 서버로 보내지 않음.
const P = 'omniweb.'

export const DEFAULTS = {
  provider: 'gemini',
  lang: 'ko',
  'model.gemini': '',
  'model.openai': '',
  'model.anthropic': '',
  monthlyLimit: 3000000, // 월 AI 사용 한도(글자 수, 0 = 무제한)
  maxInput: 60000, // 한 번에 보낼 최대 글자 수
  modelsAutoRefresh: true,
  autoLatest: true,
  theme: 'system', // system | light | dark
  'tts.engine': 'browser', // browser | gemini | openai
  'tts.voice.browser': '',
  'tts.voice.gemini': 'Kore',
  'tts.voice.openai': 'alloy',
  'tts.gemini.model': 'gemini-3.1-flash-tts-preview',
  'tts.gemini.style': '',
  'tts.openai.model': 'gpt-4o-mini-tts',
  'tts.rate': 1,
  favoriteRate: 1.5,
  urlReader: false // 외부 서비스(r.jina.ai)로 웹 주소 본문 가져오기
}

export function get(key) {
  try {
    const v = localStorage.getItem(P + key)
    return v === null ? DEFAULTS[key] : JSON.parse(v)
  } catch {
    return DEFAULTS[key]
  }
}

export function set(key, value) {
  localStorage.setItem(P + key, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent('omni:setting', { detail: { key, value } }))
}

export function del(key) {
  localStorage.removeItem(P + key)
}

// API 키: 같은 localStorage지만 이름을 구분 (백업 파일에 포함할지 선택 가능)
export const getKey = (provider) => localStorage.getItem(P + 'key.' + provider) || ''
export const setKey = (provider, k) =>
  k ? localStorage.setItem(P + 'key.' + provider, k.trim()) : localStorage.removeItem(P + 'key.' + provider)

// 월 사용량 (글자 수)
const month = () => new Date().toISOString().slice(0, 7)
export function usage() {
  const u = get('usage') || {}
  return u.month === month() ? u : { month: month(), by: {} }
}
export function addUsage(provider, chars) {
  if (provider === 'mock') return
  const u = usage()
  u.by[provider] = (u.by[provider] || 0) + chars
  set('usage', u)
}
export function checkBudget(extra) {
  const limit = Number(get('monthlyLimit')) || 0
  if (!limit) return
  const used = Object.values(usage().by).reduce((a, b) => a + b, 0)
  if (used + extra > limit)
    throw new Error(
      `이번 달 AI 사용 한도(${limit.toLocaleString()}자)에 도달했습니다 (사용 ${used.toLocaleString()}자). 설정에서 한도를 늘릴 수 있습니다.`
    )
}

// 백업 · 복원
export function exportAll(includeKeys) {
  const out = {}
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (!k.startsWith(P)) continue
    if (!includeKeys && k.startsWith(P + 'key.')) continue
    out[k] = localStorage.getItem(k)
  }
  return { app: 'OmniBrowser Web', version: 1, saved: new Date().toISOString(), data: out }
}
export function importAll(obj) {
  if (!obj || obj.app !== 'OmniBrowser Web' || typeof obj.data !== 'object') throw new Error('OmniBrowser Web 백업 파일이 아닙니다')
  let n = 0
  for (const [k, v] of Object.entries(obj.data)) {
    if (k.startsWith(P) && typeof v === 'string') {
      localStorage.setItem(k, v)
      n++
    }
  }
  return n
}
export function resetAll() {
  const keys = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k.startsWith(P)) keys.push(k)
  }
  keys.forEach((k) => localStorage.removeItem(k))
}
