// 여러 화면이 함께 쓰는 "지금 다루는 문서"와 AI 대화
import * as store from './store.js'

const saved = store.get('doc') || {}
export const doc = { title: saved.title || '', text: saved.text || '', url: saved.url || '' }
export const thread = [] // {label, question?, answer, streaming, error, ctrl}

export function setDoc(d) {
  Object.assign(doc, { title: d.title || '', text: d.text || '', url: d.url || '' })
  saveDoc()
  window.dispatchEvent(new CustomEvent('omni:doc'))
}
let t
export function saveDoc() {
  clearTimeout(t)
  t = setTimeout(() => {
    try {
      store.set('doc', doc)
    } catch {
      /* 저장 공간 초과 → 무시 (다음 실행 때 비어 있음) */
    }
  }, 400)
}

// 읽어주기 화면으로 넘길 글
export const listenQueue = { text: '', title: '' }
