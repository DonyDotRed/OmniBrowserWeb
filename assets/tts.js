// 읽어주기 엔진 3종: 브라우저 내장 음성(무료) · Google Gemini TTS · OpenAI TTS
import * as store from './store.js'

export const ENGINES = {
  browser: '브라우저 내장 음성 (무료, 설치 없음)',
  gemini: 'Google Gemini TTS (유료, 자연스러움)',
  openai: 'OpenAI TTS (유료)'
}
export const GEMINI_VOICES = ['Kore', 'Puck', 'Charon', 'Fenrir', 'Leda', 'Orus', 'Aoede', 'Zephyr', 'Callirrhoe', 'Autonoe',
  'Enceladus', 'Iapetus', 'Umbriel', 'Algieba', 'Despina', 'Erinome', 'Algenib', 'Rasalgethi', 'Laomedeia', 'Achernar',
  'Alnilam', 'Schedar', 'Gacrux', 'Pulcherrima', 'Achird', 'Zubenelgenubi', 'Vindemiatrix', 'Sadachbia', 'Sadaltager', 'Sulafat']
export const OPENAI_VOICES = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'nova', 'onyx', 'sage', 'shimmer', 'verse', 'marin', 'cedar']

export function browserVoices() {
  return new Promise((ok) => {
    const v = speechSynthesis.getVoices()
    if (v.length) return ok(v)
    speechSynthesis.addEventListener('voiceschanged', () => ok(speechSynthesis.getVoices()), { once: true })
    setTimeout(() => ok(speechSynthesis.getVoices()), 1500)
  })
}

/** 문장 나누기 (최대 300자) */
export function sentences(text) {
  const out = []
  for (const para of text.replace(/\r/g, '').split(/\n+/)) {
    const p = para.trim()
    if (!p) continue
    for (const s of p.match(/[^.!?。？！…]+[.!?。？！…]*["'”’)\]]*\s*/g) || [p]) {
      let x = s.trim()
      while (x.length > 300) {
        const cut = Math.max(x.lastIndexOf(',', 300), x.lastIndexOf(' ', 300), 150)
        out.push(x.slice(0, cut + 1).trim())
        x = x.slice(cut + 1).trim()
      }
      if (x) out.push(x)
    }
  }
  return out
}

const isKo = (t) => (t.match(/[가-힣]/g) || []).length > t.length * 0.2

function wav(pcm, rate) {
  const b = new ArrayBuffer(44 + pcm.length)
  const v = new DataView(b)
  const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)))
  w(0, 'RIFF'); v.setUint32(4, 36 + pcm.length, true); w(8, 'WAVE'); w(12, 'fmt ')
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true)
  v.setUint32(24, rate, true); v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true)
  w(36, 'data'); v.setUint32(40, pcm.length, true)
  new Uint8Array(b, 44).set(pcm)
  return new Blob([b], { type: 'audio/wav' })
}

const cache = new Map() // 같은 문장은 다시 합성하지 않음 (요금 절약)

/** 클라우드 엔진: 문장 → 오디오 Blob (+ 저장용 원시 데이터) */
export async function synth(engine, text) {
  const voice = store.get('tts.voice.' + engine)
  const key = [engine, voice, store.get(`tts.${engine}.model`), store.get('tts.gemini.style'), text].join('|')
  if (cache.has(key)) return cache.get(key)
  let item
  if (engine === 'gemini') {
    const k = store.getKey('gemini')
    if (!k) throw new Error('Gemini API 키가 없습니다. 설정에서 등록하세요.')
    const style = (store.get('tts.gemini.style') || '').trim()
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(store.get('tts.gemini.model'))}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': k },
      body: JSON.stringify({
        contents: [{ parts: [{ text: style ? `${style}\n\n${text}` : text }] }],
        generationConfig: { responseModalities: ['AUDIO'], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice || 'Kore' } } } }
      })
    })
    if (!res.ok) throw new Error(`Gemini TTS 오류 ${res.status} — ${res.status === 404 ? '설정에서 TTS 모델을 🔄 최신 목록으로 다시 고르세요' : 'API 키·사용 한도를 확인하세요'}`)
    const part = (await res.json()).candidates?.[0]?.content?.parts?.[0]?.inlineData
    if (!part) throw new Error('Gemini가 음성을 돌려주지 않았습니다.')
    const bin = Uint8Array.from(atob(part.data), (c) => c.charCodeAt(0))
    const rate = Number(part.mimeType?.match(/rate=(\d+)/)?.[1] || 24000)
    item = { blob: wav(bin, rate), pcm: bin, rate }
  } else {
    const k = store.getKey('openai')
    if (!k) throw new Error('OpenAI API 키가 없습니다. 설정에서 등록하세요.')
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + k },
      body: JSON.stringify({ model: store.get('tts.openai.model'), voice: voice || 'alloy', input: text, response_format: 'mp3' })
    })
    if (!res.ok) throw new Error(`OpenAI TTS 오류 ${res.status} — API 키·모델 이름·사용 한도를 확인하세요`)
    item = { blob: await res.blob() }
  }
  store.addUsage(engine, text.length)
  cache.set(key, item)
  return item
}

/** 합성한 문장들을 한 파일로 (Gemini → WAV, OpenAI → MP3) */
export function joinAudio(engine, items) {
  if (engine === 'gemini') {
    const total = items.reduce((a, x) => a + x.pcm.length, 0)
    const all = new Uint8Array(total)
    let o = 0
    for (const x of items) {
      all.set(x.pcm, o)
      o += x.pcm.length
    }
    return wav(all, items[0]?.rate || 24000)
  }
  return new Blob(items.map((x) => x.blob), { type: 'audio/mpeg' })
}

/**
 * 순서대로 읽는 재생기. 클라우드 엔진은 다음 2문장을 미리 합성해 끊김을 줄인다.
 * onIndex(i): 지금 읽는 문장 번호, onEnd(): 끝
 */
export class Reader {
  constructor({ onIndex, onEnd, onError }) {
    Object.assign(this, { onIndex, onEnd, onError })
    this.audio = new Audio()
    this.audio.preservesPitch = true
    this.token = 0
  }
  get rate() {
    return Number(store.get('tts.rate')) || 1
  }
  setRate(r) {
    store.set('tts.rate', r)
    this.audio.playbackRate = r
  }
  stop() {
    this.token++
    this.audio.pause()
    speechSynthesis.cancel()
    this.playing = false
  }
  pause() {
    if (this.engine === 'browser') speechSynthesis.pause()
    else this.audio.pause()
    this.paused = true
  }
  resume() {
    if (this.engine === 'browser') speechSynthesis.resume()
    else this.audio.play()
    this.paused = false
  }
  async start(list, from = 0) {
    this.stop()
    const my = ++this.token
    this.engine = store.get('tts.engine')
    this.playing = true
    this.paused = false
    const alive = () => my === this.token
    try {
      if (this.engine === 'browser') {
        const voices = await browserVoices()
        const want = store.get('tts.voice.browser')
        for (let i = from; i < list.length && alive(); i++) {
          this.onIndex(i)
          await new Promise((done) => {
            const u = new SpeechSynthesisUtterance(list[i])
            u.lang = isKo(list[i]) ? 'ko-KR' : 'en-US'
            const v = voices.find((x) => x.name === want && x.lang.slice(0, 2) === u.lang.slice(0, 2)) || voices.find((x) => x.lang.startsWith(u.lang.slice(0, 2)))
            if (v) u.voice = v
            u.rate = Math.min(Math.max(this.rate, 0.5), 3)
            u.onend = u.onerror = done
            speechSynthesis.speak(u)
          })
        }
      } else {
        const pending = new Map()
        const get = (i) => {
          if (!pending.has(i)) pending.set(i, synth(this.engine, list[i]))
          return pending.get(i)
        }
        for (let i = from; i < list.length && alive(); i++) {
          for (let j = i + 1; j <= i + 2 && j < list.length; j++) get(j).catch(() => {})
          const item = await get(i)
          if (!alive()) return
          this.onIndex(i)
          this.audio.src = URL.createObjectURL(item.blob)
          this.audio.playbackRate = this.rate
          await this.audio.play()
          await new Promise((done) => {
            this.audio.onended = done
            this.audio.onerror = done
          })
          URL.revokeObjectURL(this.audio.src)
        }
      }
      if (alive()) {
        this.playing = false
        this.onEnd()
      }
    } catch (e) {
      this.playing = false
      if (alive()) this.onError(e)
    }
  }
}
