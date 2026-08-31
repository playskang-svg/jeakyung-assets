# HL홀딩스(주) 적격수급사 안전보건 평가 제출본 — 웹 게시 사이트

유한회사 재경물류의 32개 안전보건 제출 문서(구글 문서/시트)를 정적 웹사이트로 공개합니다.

**핵심 원칙**: 웹에서 보이는 내용과 다운로드되는 문서 내용이 100% 일치해야 합니다.
`build.mjs`는 매 실행마다 `data/documents.json`에 등록된 32개 문서를 구글 export URL에서
직접 fetch하여 `docs/{번호}.html`을 생성합니다 — 수작업 재입력 없음, 서버·DB 없음.

## 재빌드

구글 문서/시트를 수정한 뒤:

```sh
npm run build
```

`docs/`와 `index.html`, `robots.txt`가 전부 새로 생성됩니다. (Node 18+, 의존성 0개)

## 배포

Netlify에 연결되어 있습니다. `netlify.toml`이 `npm run build`를 빌드 커맨드로 지정해
두었으므로, 이 폴더를 이 사이트에 다시 배포하면 Netlify가 매번 최신 구글 문서 내용으로
새로 빌드합니다.

## 구조

- `data/documents.json` — 32개 문서 메타데이터(번호/제목/유형/ID/평가항목/배점/요약/담당)
- `build.mjs` — 빌드 오케스트레이터
- `lib/clean-doc.mjs` — 구글 문서 HTML export 정제 + 서명 이미지 삽입
- `lib/clean-sheet.mjs` — 구글 시트 CSV export → HTML 표 변환
- `lib/templates.mjs` — 메인/상세 페이지 HTML 템플릿
- `assets/` — CSS, 서명 이미지(4종, SVG→PNG 직접 생성, 이미지 생성 API 미사용)
- `docs/`, `index.html`, `robots.txt` — 빌드 산출물(커밋되어 있음 = 항상 배포 가능한 상태 유지)

## 주의

- 문서 안의 노란색(`#fff2cc`) 셀은 "재경물류 실제 값 확인 필요" 표시이므로 임의로 채우지 않았습니다.
- 구글 시트는 CSV로 export하므로 셀 배경색이 보존되지 않습니다(CSV 자체의 한계). 셀 색상이
  중요한 표는 구글 시트 원본에서 직접 확인하세요.
- 이 사이트는 초안입니다 — 실제 제출본은 대표이사 실날인·자필 서명본으로 대체됩니다.
