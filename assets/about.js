// 소개 · 내려받기: 웹판과 데스크톱 앱의 차이, 데스크톱 앱 내려받기
import { h } from './ui.js'

const ROWS = [
  ['AI 요약·번역·정리·질문 (Gemini·OpenAI·Claude)', 'y', 'y', '웹판은 키를 이 브라우저에 저장하고 각 회사로 직접 요청'],
  ['AI 모델 최신 목록 갱신 · 추천 · 단종 시 자동 대체', 'y', 'y', ''],
  ['긴 문서 전체 번역 (원문·번역 나란히)', 'y', 'y', '데스크톱은 웹 페이지 위에 바로 번역도 표시'],
  ['PDF · DOCX · TXT · MD · HTML · 자막 파일 읽기', 'y', 'y', '스캔 이미지 PDF·HWP는 웹판에서 읽지 못함'],
  ['읽어주기 (브라우저 음성 · Gemini · OpenAI)', 'y', 'y', '데스크톱은 무료 로컬 엔진 Supertonic 3 포함'],
  ['내 PC 영상 0.1~10배속 · 구간 반복 · 프레임 이동', 'y', 'y', ''],
  ['다른 사이트 영상 배속 · PiP · 다크 모드', '북마크릿', 'y', '데스크톱은 단축키만 누르면 됨, 사이트별 배속 기억'],
  ['이 페이지의 문서 링크 한 번에 받기', '북마크릿', 'y', ''],
  ['하위 페이지까지 자동 수집하는 크롤러 (Markdown·PDF·HWP…)', 'n', 'y', '브라우저 보안 규칙상 웹판은 다른 사이트를 모아 읽을 수 없음'],
  ['"Web Page Blocked" 사이트 호환 (최신 Chrome으로 표시)', 'n', 'y', ''],
  ['세로 탭 · 워크스페이스(계정 분리) · 세션 복원', 'n', 'y', ''],
  ['광고·추적기 차단 · 다운로드 관리', 'n', 'y', ''],
  ['메모 · 백업/복원', 'y', 'y', ''],
  ['설치 없이 휴대폰·회사 PC에서 사용', 'y', 'n', '웹판은 앱처럼 설치(PWA)도 가능']
]

export function renderAbout(main) {
  const cell = (v) => (v === 'y' ? h('td.y', '가능') : v === 'n' ? h('td.n', '—') : h('td.y', v))
  main.replaceChildren(
    h('header.head', h('div.grow', h('h1', '소개 · 내려받기'), h('p', 'OmniBrowser Web은 데스크톱 OmniBrowser의 기능 중 서버 없이 브라우저만으로 되는 것을 모은 작업대입니다.'))),
    h('div.pad',
      h('section.panel',
        h('h2', '웹판과 데스크톱 앱'),
        h('p.lead', '웹판은 설치 없이 어디서나 열리고, 데스크톱 앱은 웹 사이트 자체를 다루는 기능(크롤러·사이트 호환·탭)까지 합니다.'),
        h('div.table-wrap', h('table.compare',
          h('thead', h('tr', h('th', '기능'), h('th', '웹판 (이 사이트)'), h('th', '데스크톱 앱'), h('th', '참고'))),
          h('tbody', ROWS.map(([f, w, d, n]) => h('tr', h('td', f), cell(w), cell(d), h('td.hint', n))))
        ))
      ),
      h('div.cols',
        h('section.panel',
          h('h2', '데스크톱 앱 내려받기 (Windows)'),
          h('p.lead', '압축을 영문 경로(예: C:\\dev\\omnibrowser)에 풀고 setup.bat → run.bat 순서로 실행합니다. 처음 설치는 5~10분.'),
          h('div.row',
            h('a.btn.primary', { href: 'downloads/omnibrowser-v0.3.1.zip', download: '' }, 'OmniBrowser v0.3.1 (ZIP)'),
            h('a.btn', { href: 'downloads/OmniBrowser_Design_Spec_v3.3.md', download: '' }, '상세 설계서 v3.3'))
        ),
        h('section.panel',
          h('h2', '앱처럼 설치하기'),
          h('p.lead', 'Chrome·Edge 주소창 오른쪽의 설치 아이콘(또는 메뉴 → 앱 → 이 사이트를 앱으로 설치)을 누르면 작업 표시줄에서 바로 열 수 있습니다. 한 번 연 뒤에는 인터넷이 없어도 메모·영상 배속·파일 읽기가 됩니다.')
        ),
        h('section.panel',
          h('h2', '개인 정보'),
          h('p.lead', '이 사이트에는 서버가 없습니다. 메모·설정·API 키는 이 브라우저 저장소에만 있고, AI 요청은 이 브라우저에서 선택한 AI 회사로 바로 갑니다. 회사 내부 문서는 AI로 보내기 전에 보안 규정을 확인하세요.')
        )
      ),
      h('p.hint', '사용한 공개 소프트웨어: marked, DOMPurify, Mozilla Readability, Turndown, mammoth, PDF.js — ', h('a', { href: 'vendor/LICENSES.txt' }, '라이선스 보기'))
    )
  )
}
