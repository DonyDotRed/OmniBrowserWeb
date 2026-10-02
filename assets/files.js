// 파일·웹 문서 → 글자. 모두 브라우저 안에서 처리 (파일을 어디에도 올리지 않음)
const loaded = {}
function script(src) {
  if (!loaded[src])
    loaded[src] = new Promise((ok, bad) => {
      const s = document.createElement('script')
      s.src = src
      s.onload = ok
      s.onerror = () => bad(new Error('라이브러리를 불러오지 못했습니다: ' + src))
      document.head.append(s)
    })
  return loaded[src]
}

export const ACCEPT = '.txt,.md,.markdown,.csv,.tsv,.json,.srt,.vtt,.log,.html,.htm,.pdf,.docx'

/** HTML → 본문만 골라 Markdown (광고·메뉴 제거) */
export async function htmlToMarkdown(html, url = '') {
  await script(new URL('../vendor/Readability.js', import.meta.url).href)
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (url) {
    const base = doc.createElement('base')
    base.href = url
    doc.head.prepend(base)
  }
  let title = doc.title
  let body = doc.body?.innerHTML || ''
  try {
    const art = new window.Readability(doc.cloneNode(true), { charThreshold: 200 }).parse()
    if (art?.content) {
      body = art.content
      title = art.title || title
    }
  } catch {
    /* 본문 추출 실패 → 전체 사용 */
  }
  const { default: TurndownService } = await import('../vendor/turndown.es.js')
  const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced', bulletListMarker: '-' })
  td.remove(['script', 'style', 'noscript', 'iframe', 'form', 'button'])
  return { title: title || '웹 문서', text: td.turndown(body).replace(/\n{3,}/g, '\n\n').trim() }
}

async function pdfText(buf) {
  const pdfjs = await import('../vendor/pdf.min.mjs')
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../vendor/pdf.worker.min.mjs', import.meta.url).href
  const doc = await pdfjs.getDocument({
    data: buf,
    // 한글 등 CJK 글꼴 문자표 (온라인일 때만 사용, 없으면 대부분의 PDF는 그대로 읽힘)
    cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/',
    cMapPacked: true
  }).promise
  const pages = []
  for (let i = 1; i <= doc.numPages; i++) {
    const c = await (await doc.getPage(i)).getTextContent()
    let line = ''
    let lastY = null
    const lines = []
    for (const it of c.items) {
      const y = it.transform?.[5]
      if (lastY !== null && Math.abs(y - lastY) > 2) {
        lines.push(line)
        line = ''
      }
      line += it.str
      if (it.hasEOL) {
        lines.push(line)
        line = ''
      }
      lastY = y
    }
    lines.push(line)
    pages.push(`<!-- ${i}쪽 -->\n` + lines.map((l) => l.trim()).filter(Boolean).join('\n'))
  }
  const text = pages.join('\n\n')
  if (text.replace(/<!--.*?-->/g, '').trim().length < 20)
    throw new Error('PDF에서 글자를 찾지 못했습니다. 스캔한 이미지 PDF는 글자 인식(OCR)이 필요해 이 웹판에서는 읽을 수 없습니다.')
  return text
}

async function docxText(buf) {
  await script(new URL('../vendor/mammoth.browser.min.js', import.meta.url).href)
  const r = await window.mammoth.convertToHtml({ arrayBuffer: buf })
  return (await htmlToMarkdown(`<html><body><article>${r.value}</article></body></html>`)).text
}

/** 파일 → {title, text} */
export async function readFile(file) {
  const name = file.name
  const ext = name.split('.').pop().toLowerCase()
  const title = name.replace(/\.[^.]+$/, '')
  if (file.size > 60 * 1024 * 1024) throw new Error('60MB보다 큰 파일은 열 수 없습니다.')
  if (ext === 'pdf') return { title, text: await pdfText(await file.arrayBuffer()) }
  if (ext === 'docx') return { title, text: await docxText(await file.arrayBuffer()) }
  if (ext === 'doc' || ext === 'hwp' || ext === 'hwpx')
    throw new Error(`.${ext} 파일은 웹판에서 읽을 수 없습니다. 한글·Word에서 "다른 이름으로 저장 → PDF 또는 DOCX"로 바꿔 여세요.`)
  const raw = await file.text()
  if (ext === 'html' || ext === 'htm') return htmlToMarkdown(raw)
  if (ext === 'srt' || ext === 'vtt')
    return { title, text: raw.replace(/^\uFEFF?WEBVTT.*$/m, '').replace(/^\d+\s*$/gm, '').replace(/^[\d:.,]+ --> .*$/gm, '').replace(/\n{2,}/g, '\n').trim() }
  return { title, text: raw }
}

/** 웹 주소 → 본문 (선택 기능: 외부 서비스 r.jina.ai 사용) */
export async function readUrl(url) {
  if (!/^https?:\/\//i.test(url)) throw new Error('http:// 또는 https:// 로 시작하는 주소를 넣으세요.')
  let res
  try {
    res = await fetch('https://r.jina.ai/' + url, { headers: { Accept: 'text/plain' } })
  } catch {
    throw new Error('주소를 가져오지 못했습니다. 그 페이지를 연 상태에서 "AI로 보내기" 북마크릿을 쓰세요.')
  }
  if (!res.ok) throw new Error(`가져오기 실패 (${res.status}). 로그인이 필요한 페이지는 "AI로 보내기" 북마크릿을 쓰세요.`)
  const text = await res.text()
  const title = text.match(/^Title:\s*(.+)$/m)?.[1] || url
  return { title, text: text.replace(/^(Title|URL Source|Published Time):.*$/gm, '').replace(/^Markdown Content:\s*$/m, '').trim(), url }
}
