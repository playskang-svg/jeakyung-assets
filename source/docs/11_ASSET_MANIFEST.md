# Asset Manifest

## 1. 문서 목적

이 문서는 재경닷컴 웹사이트에서 관리하는 이미지, 영상, 아이콘, 문서 등 실제 자산의 파일 정보와 사용 상태를 기록한다.

- 웹사이트 전체 요구사항은 [`../WEBSITE_SPEC.md`](../WEBSITE_SPEC.md)를 기준으로 한다.
- 자산의 시각적 참고 목적과 적용 결정은 [`12_REFERENCES.md`](12_REFERENCES.md)에 기록한다.
- 확인되지 않은 정보는 추측하지 않고 `[미정]`으로 표시한다.
- 파일의 존재만으로 사용 권한이 확인된 것으로 판단하지 않는다.

## 2. 상태 정의

| 상태 | 의미 |
| --- | --- |
| Placeholder | 경로만 존재하며 실제 콘텐츠가 없는 파일 |
| Source Needed | 출처 또는 권리 정보 확인이 필요함 |
| Ready for Review | 파일과 기본 정보가 준비되어 검토 가능함 |
| Approved | 사용 목적과 권리가 승인됨 |
| Applied | 실제 웹사이트에서 사용 중임 |
| Blocked | 권리, 품질 또는 기술 문제로 사용할 수 없음 |
| Deprecated | 더 이상 사용하지 않음 |

## 3. 자산 목록

| Asset ID | 파일 경로 | 유형 | 용도 | 적용 Page | 적용 Section | 적용 기기 | 권리 상태 | 최적화 상태 | 사용 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `AST-VID-HOME-HERO-001` | `public/videos/main_top.mp4` | MP4 영상 | 메인 Hero 배경 | `PAGE-HOME` | `SEC-HOME-HERO` | PC·태블릿·모바일 | 상업적 사용 가능 | 미최적화 | Applied |
| `AST-IMG-ABOUT-CEO-001` | `public/images/ceo-yeom-dalseong.webp` | WebP 이미지 | 메인 소개 상단 대표 인사말 | `PAGE-HOME` | `SEC-ABOUT-GREETING` | PC·태블릿·모바일 | 상업적 사용 가능 | 원본 유지 | Applied |
| `AST-IMG-KAKAO-CTA-001` | 삭제됨 — 기존 `public/images/kakao-talk-consultation.png` | PNG 이미지 | 이전 카카오톡 상담 CTA 식별 이미지 | `PAGE-HOME`, `PAGE-PRIVACY` | 적용 종료 | 해당 없음 | 사용자 제공·상표 조건 미확인 | 해당 없음 | Deprecated |

## 4. 자산 상세

### AST-VID-HOME-HERO-001

- 파일명: `main_top.mp4`
- 현재 경로: `public/videos/main_top.mp4`
- 미디어 유형: 영상
- 컨테이너 형식: MP4
- MIME 유형: `video/mp4`
- 파일 크기: 1,533,192바이트(약 1.46MB)
- 화면 크기: `[미정]`
- 화면 비율: `[미정]`
- 재생 시간: `[미정]`
- 영상 코덱: `[미정]`
- 프레임 레이트: `[미정]`
- 오디오 포함 여부: `[미정]`
- 대상 페이지: 메인 페이지 `index.html`
- Page ID: `PAGE-HOME`
- 대상 Section: 로고 아래 상단 Hero
- Section ID: `SEC-HOME-HERO`
- 사용 목적: Hero 전체 배경 영상
- 재생 방식: 자동 재생, 반복 재생, 음소거, 인라인 재생
- 텍스트 관계: 기존 Hero 제목, 설명, CTA를 영상 위에 배치
- 적용 기기: PC, 태블릿, 모바일
- 실제 코드 경로: `index.html`의 `public/videos/main_top.mp4`
- 대체 처리: 영상 로딩 오류 시 CSS 기반 네이비 그라데이션 배경 사용
- 저작권자: `[미정]`
- 출처: `[미정]`
- 상업적 사용: 가능 — 사용자 확인
- 출처 표기: 불필요 — 사용자 확인
- 사용 승인 상태: Approved
- 사이트 적용 상태: Applied
- 최적화 상태: 원본 유지, 별도 최적화 미실시
- 마지막 확인일: 2026-07-29

### AST-IMG-ABOUT-CEO-001

- 파일명: `ceo-yeom-dalseong.webp`
- 원본 파일명: `대표이사 염달성.webp`
- 원본 위치: `/Users/sgk/Downloads/대표이사 염달성.webp`
- 현재 경로: `public/images/ceo-yeom-dalseong.webp`
- 미디어 유형: 이미지
- 파일 형식: WebP
- MIME 유형: `image/webp`
- 파일 크기: 40,474바이트(약 39.53KB)
- 화면 크기: 821×1024px
- 화면 비율: 약 0.80:1, 세로형
- 투명도: 없음
- SHA-256: `66a6bb6f1403a5aa9d299c7d3404d0151b635e8896668fffca1243016d2f819d`
- 이미지 내용: 인물 사진, `대표이사 염달성` 텍스트 및 서명 이미지가 포함된 세로형 구성
- 대상 Page: 메인 페이지 `index.html`
- Page ID: `PAGE-HOME`
- 대상 Section: 소개 콘텐츠 최상단 대표 인사말
- Section ID: `SEC-ABOUT-GREETING`
- 사용 목적: 소개 상단 대표 이미지
- 적용 기기: PC, 태블릿, 모바일
- PC 배치: 좌측 이미지
- 모바일 배치: 상단 이미지
- 원본 보존: 이름 및 서명 영역을 포함한 전체 이미지 노출 우선
- 대체 텍스트: `재경닷컴 대표이사 염달성`
- 제공 방식: 사용자가 로컬 파일로 제공
- 저작권자: `[미정]`
- 출처: 사용자 제공, 원저작 출처 `[미정]`
- 초상권 사용 동의: 가능 — 사용자 확인
- 상업적 사용: 가능 — 사용자 확인
- 출처 표기: `[미정]`
- 사용 승인 상태: Approved
- 사이트 적용 상태: Applied
- 최적화 상태: 원본 유지, 별도 최적화 미실시
- 파일 작업 내역: 원본을 변경하지 않고 표준 영문 파일명으로 `public/images/`에 복사
- 실제 코드 경로: `index.html`의 `public/images/ceo-yeom-dalseong.webp`
- 마지막 확인일: 2026-07-29

### AST-IMG-KAKAO-CTA-001

- 파일명: `kakao-talk-consultation.png`
- 원본 파일명: `kakotalk-images.png`
- 원본 위치: `/Users/sgk/Downloads/kakotalk-images.png`
- 현재 경로: 삭제됨 — 기존 `public/images/kakao-talk-consultation.png`
- 미디어 유형: 이미지
- 파일 형식: PNG
- MIME 유형: `image/png`
- 파일 크기: 1,849바이트
- 화면 크기: 192×128px
- 화면 비율: 3:2
- 투명도: 없음
- SHA-256: `c676a9dfcc64c8f1360d578a4d1dd25f3cadcdb45dd79e377a20915acfe9dcc6`
- 이미지 내용: 노란색 배경 위 `TALK` 말풍선 심볼
- 대상 Page: 메인 페이지와 개인정보처리방침 페이지
- 사용 목적: 이전 카카오톡 상담 CTA를 직관적으로 식별하던 보조 이미지 — 현재 사용하지 않음
- 표시 위치: 적용 종료 — 과거 PC 헤더, 모바일 메뉴, 메인 Hero와 하단 상담 CTA
- 리사이징 방식: 원본 파일을 변환하지 않고 CSS에서 3:2 비율을 유지해 34~42px 너비로 표시하며, 중앙 TALK 말풍선 식별을 위해 컨테이너 안에서 1.65배 확대
- 대체 텍스트: 해당 없음 — HTML에서 이미지 요소 제거
- 제공 방식: 사용자가 로컬 파일로 제공하고 실제 사이트 사용을 요청
- 저작권자 및 상표권자: `[미정]`
- 상업적 사용 조건: `[미정 — 카카오 브랜드·상표 사용 조건 별도 확인 필요]`
- 출처 표기: `[미정]`
- 사용 승인 상태: Deprecated — 사용자 요청으로 적용 종료
- 사이트 적용 상태: Not Applied
- 최적화 상태: 해당 없음
- 폐기 사유: 사용자가 이미지 문제를 확인하여 CTA에서 이미지를 제거하도록 요청함
- 파일 작업 내역: 2026-07-29 `public/images/kakao-talk-consultation.png` 삭제, HTML·CSS 참조 제거
- 복구 가능 여부: Git 이력의 기존 적용 커밋에서 복구 가능
- 마지막 확인일: 2026-07-29

## 5. 적용 전후 점검 항목

### 권리

- 상업적 웹사이트 사용 가능 여부를 확인한다.
- 제3자 인물, 상표, 시설이 포함된 경우 추가 권리 확인이 필요한지 검토한다.
- 출처 표기 조건이 변경되면 이 문서와 참고 자료 문서를 함께 갱신한다.

### 영상 품질 및 성능

- 원본 해상도와 화면 비율을 확인한다.
- 모바일 네트워크 환경에서 초기 로딩 영향을 확인한다.
- 필요할 경우 사용자 승인 후 별도 최적화 파일을 생성한다.
- 최적화 전에는 원본 파일을 덮어쓰거나 이름을 변경하지 않는다.
- 영상 로딩 실패 시 대체 배경이 정상적으로 표시되는지 확인한다.

### 접근성 및 재생

- 자동 재생 영상은 음소거 상태를 유지한다.
- 모바일 브라우저를 위해 `playsinline`을 사용한다.
- 중요한 정보는 영상에만 포함하지 않는다.
- `prefers-reduced-motion` 사용자 환경에서 움직임의 영향을 검토한다.
- 영상 위 텍스트의 명도 대비를 실제 화면에서 확인한다.

## 6. 등록 제외 파일

다음 파일은 현재 0바이트이므로 사용 가능한 자산으로 등록하지 않는다.

| 파일 경로 | 현재 상태 | 등록 조건 |
| --- | --- | --- |
| `references/images/hero-reference.jpg` | Placeholder | 실제 이미지와 권리 정보 제공 필요 |
| `references/images/service-reference-01.jpg` | Placeholder | 실제 이미지와 권리 정보 제공 필요 |
| `references/images/company-reference.jpg` | Placeholder | 실제 이미지와 권리 정보 제공 필요 |

실제 파일이 추가되면 파일 크기, 형식, 사용 목적, 출처 및 사용 권한을 다시 확인한 후 고유 Asset ID를 부여한다.

## 7. 변경 규칙

- 파일 이동, 이름 변경, `public` 폴더 복사, 변환 또는 최적화 전에 사용자 승인을 받는다.
- 자산을 교체하더라도 기존 Asset ID의 이력을 임의로 삭제하지 않는다.
- 동일 목적의 새 파일은 별도 Asset ID를 발급하고 이전 자산의 상태를 `Deprecated`로 변경한다.
- 실제 코드 적용 상태와 문서의 사용 상태가 일치해야 한다.
