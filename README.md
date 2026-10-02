# OmniBrowser Web

문서를 AI로 요약·번역·정리하고, 소리 내어 읽고, 영상 배속을 조절하는 개인용 작업대입니다.
서버 없이 브라우저만으로 동작하므로 **GitHub Pages**에 그대로 올려 쓸 수 있습니다.

## GitHub에 올리기 (10분, 처음 한 번)

1. GitHub에 로그인 → 오른쪽 위 **+ → New repository**
   - Repository name: 예) `omniweb` · **Public** 선택 → **Create repository**
2. 새 저장소 화면의 **uploading an existing file** 링크(또는 **Add file → Upload files**)를 누릅니다.
3. 내려받은 압축을 풀고, **`omnibrowser-web` 폴더 안의 파일과 폴더 전부**를 선택해 업로드 칸에 끌어다 놓습니다.
   - `omnibrowser-web` 폴더 자체가 아니라 **그 안의 것들**을 끌어다 놓아야 `index.html`이 맨 위에 옵니다.
   - `.nojekyll` 파일이 안 보이면 Windows 탐색기 → 보기 → **숨긴 항목** 체크 (없어도 동작합니다).
4. 아래 **Commit changes** 클릭 (올리는 데 1~2분)
5. 저장소 **Settings → Pages**
   - Source: **Deploy from a branch** · Branch: **main** · 폴더: **/ (root)** → **Save**
6. 1~3분 뒤 같은 화면 위쪽에 주소가 나타납니다: `https://아이디.github.io/omniweb/`

### 고칠 때
파일을 다시 올리면(같은 이름은 덮어쓰기) 1~2분 뒤 사이트에 반영됩니다.
브라우저가 예전 화면을 보여 주면 **Ctrl+F5**(강력 새로고침)를 누르세요.

## 처음 쓸 때

1. 사이트에서 **설정 → AI**에 Gemini·OpenAI·Claude 중 쓸 회사의 API 키를 등록합니다.
2. **작업대**에 글을 붙여넣거나 파일(PDF·DOCX·TXT·MD·HTML·자막)을 끌어다 놓고 요약·번역·정리를 누릅니다.
3. **북마크릿** 메뉴의 단추들을 즐겨찾기 막대로 끌어다 두면, 다른 사이트에서 배속 조절·AI로 보내기·문서 링크 모으기를 쓸 수 있습니다.

## 기능

| 메뉴 | 하는 일 |
|---|---|
| 작업대 | 붙여넣기·파일·북마크릿으로 받은 글을 AI로 요약·번역·정리 노트·핵심 3줄·쉽게 설명·용어 사전·퀴즈·교정·할 일 추출, 이어서 질문, 결과를 메모·Markdown으로 저장 |
| 문서 번역 | 긴 문서를 문단 단위로 끝까지 번역, 원문과 나란히 보기, 대역·번역문 저장 |
| 읽어주기 | 브라우저 내장 음성(무료)·Gemini TTS·OpenAI TTS, 읽는 문장 표시, 0.5~3배속, 음성 파일 저장 |
| 영상 배속 | 내 PC의 영상·음성을 0.1~10배속, 구간 반복, 프레임 이동, 자막(SRT·VTT), PiP, OmniBrowser와 같은 단축키 |
| 북마크릿 | 다른 사이트에서: 배속 조절·AI로 보내기·AI 요약·AI 번역·문서 링크 모으기·소리 내어 읽기·PiP·다크 모드 |
| 메모 | Markdown 메모, 검색, .md·JSON 내보내기·가져오기 |
| 설정 | API 키, 모델 최신 목록 갱신(⭐ 추천, 단종 시 자동 대체), 월 사용 한도, 읽어주기, 화면 색, 백업·복원 |
| 소개·내려받기 | 웹판과 데스크톱 앱 비교, 데스크톱 OmniBrowser(ZIP)·설계서 내려받기 |

`Ctrl+K`로 명령 팔레트를 열 수 있습니다. 사이트를 한 번 연 뒤에는 앱처럼 설치(PWA)할 수 있고, AI를 제외한 기능은 인터넷 없이도 동작합니다.

## 웹판에서 안 되는 것 (데스크톱 앱에 있음)

브라우저의 보안 규칙(다른 사이트 내용을 마음대로 읽을 수 없음) 때문에 아래 기능은 데스크톱 OmniBrowser에만 있습니다.
하위 페이지 자동 크롤러, 다른 사이트 위에 바로 번역 표시, "Web Page Blocked" 사이트 호환, 세로 탭·워크스페이스, 광고 차단, 무료 로컬 음성(Supertonic), HWP·스캔 PDF 읽기.

## 개인 정보와 보안

- 서버가 없습니다. 메모·설정·API 키는 **사용하는 브라우저의 저장소에만** 있습니다. GitHub 저장소에는 아무것도 저장되지 않습니다.
- AI 요청은 브라우저에서 선택한 회사(Google·OpenAI·Anthropic)로 바로 갑니다. 회사 내부 문서는 보안 규정을 확인하고 보내세요.
- 공용 PC에서는 사용 후 **설정 → 데이터 → 모두 지우기**로 키를 지우세요.
- API 키에는 회사 콘솔에서 **월 사용 한도**를 걸어 두기를 권장합니다.

## 파일 구성

```
index.html            화면 뼈대
assets/               화면·기능 코드 (빌드 없이 바로 동작하는 자바스크립트)
vendor/               공개 라이브러리 (marked, DOMPurify, Readability, Turndown, mammoth, PDF.js) + LICENSES.txt
icons/                앱 아이콘
downloads/            데스크톱 OmniBrowser ZIP과 설계서
manifest.webmanifest  앱 설치(PWA) 정보
sw.js                 오프라인 지원
404.html              잘못된 주소 → 처음 화면으로
```
