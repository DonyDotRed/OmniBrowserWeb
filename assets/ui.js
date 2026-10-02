// 화면 도우미: 요소 만들기, 알림, Markdown 표시(안전하게), 파일 저장
import DOMPurify from '../vendor/purify.es.mjs'
import { marked } from '../vendor/marked.esm.js'

marked.setOptions({ gfm: true, breaks: true })

/** h('div.class#id', {attrs}, ...children) */
export function h(tag, attrs, ...kids) {
  const m = tag.match(/^([a-z0-9]+)((?:[.#][\w-]+)*)$/i)
  const el = document.createElement(m ? m[1] : tag)
  if (m && m[2]) {
    for (const part of m[2].match(/[.#][\w-]+/g)) {
      if (part[0] === '.') el.classList.add(part.slice(1))
      else el.id = part.slice(1)
    }
  }
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    kids.unshift(attrs)
    attrs = null
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'html') el.innerHTML = v
    else if (k === 'value') el.value = v
    else if (k === 'checked') el.checked = !!v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue
    el.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
  return el
}

let toastTimer
export function toast(msg, ms = 2600) {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.classList.add('on')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => t.classList.remove('on'), ms)
}

/** AI 답변·메모 Markdown → 안전한 HTML (스크립트·이벤트 속성 제거) */
export function md(text) {
  const html = marked.parse(text || '', { async: false })
  return DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input', 'iframe'], FORBID_ATTR: ['style'] })
}

/** 링크는 새 창으로 */
export function newTabLinks(root) {
  root.querySelectorAll('a[href]').forEach((a) => {
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
  })
}

export function download(name, data, type = 'text/plain;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([data], { type })
  const a = h('a', { href: URL.createObjectURL(blob), download: name })
  document.body.append(a)
  a.click()
  setTimeout(() => {
    URL.revokeObjectURL(a.href)
    a.remove()
  }, 1000)
}

export async function copy(text) {
  try {
    await navigator.clipboard.writeText(text)
    toast('복사했습니다')
  } catch {
    toast('복사하지 못했습니다. 직접 선택해 복사하세요.')
  }
}

export const safeName = (s) => (s || '문서').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').trim().slice(0, 80) || '문서'
export const fmt = (n) => Number(n || 0).toLocaleString()
export const errText = (e) => String((e && e.message) || e)
