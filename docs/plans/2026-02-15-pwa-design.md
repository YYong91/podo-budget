# PWA 설계 문서

**날짜**: 2026-02-15
**상태**: 승인됨

## 개요

HomeNRich 프론트엔드를 PWA(Progressive Web App)로 전환하여 모바일 홈 화면 추가, 오프라인 앱 셸, 자동 업데이트를 지원한다.

## 접근 방식

**`vite-plugin-pwa`** 사용. Vite 생태계 공식 플러그인으로 설정만으로 Service Worker, manifest, 아이콘 자동 생성.

선택 이유: 가계부 앱은 SW의 세밀한 제어가 불필요하고, 플러그인이 Workbox 기반 캐싱 전략을 자동 생성하여 코드량 최소화.

## Service Worker 캐싱 전략

- **모드**: `generateSW` (코드 작성 불필요, 설정만으로 생성)
- **업데이트**: `registerType: 'autoUpdate'` (새 SW 감지 시 자동 활성화)

### Pre-cache (설치 시 미리 캐싱)

앱 셸: index.html, JS/CSS 번들, 폰트, 아이콘. Vite 빌드 결과물 전체 자동 포함.

### Runtime cache (요청 시 캐싱)

| 패턴 | 전략 | 설명 |
|------|------|------|
| `/api/*` | NetworkFirst | 온라인이면 서버, 오프라인이면 캐시 |
| 이미지/폰트 CDN | CacheFirst | 캐시 우선, 30일 만료 |

### 오프라인 동작

- 캐시된 앱 셸 표시 (로그인, 대시보드 UI)
- API 실패 시 기존 Axios 에러 핸들링이 처리

## Web App Manifest

```json
{
  "name": "HomeNRich - AI 가계부",
  "short_name": "HomeNRich",
  "description": "자연어로 입력하는 AI 가계부",
  "theme_color": "#f59e0b",
  "background_color": "#1c1917",
  "display": "standalone",
  "start_url": "/",
  "scope": "/"
}
```

## 아이콘

`@vite-pwa/assets-generator`로 빌드 시 자동 생성. 소스: Amber 배경 + "H" 문자 SVG 아이콘.

생성 크기: 192x192, 512x512, maskable.

## index.html 변경

- `<title>` → "HomeNRich - AI 가계부"
- `<meta name="description">` 추가
- `<meta name="theme-color">` 추가
- `<link rel="apple-touch-icon">` 추가 (iOS 홈 화면용)
- `<link rel="manifest">` — 플러그인이 자동 주입

## Nginx 변경

Service Worker 파일(`sw.js`)에 `Cache-Control: no-cache` 헤더 추가.

## 파일 변경 범위

| 파일 | 변경 |
|------|------|
| `frontend/package.json` | vite-plugin-pwa 의존성 추가 |
| `frontend/vite.config.ts` | PWA 플러그인 설정 |
| `frontend/index.html` | 메타태그, 타이틀, apple-touch-icon |
| `frontend/public/pwa-icon.svg` | 아이콘 소스 (신규) |
| `frontend/nginx.conf` | sw.js 캐싱 헤더 |

## 테스트 계획

- 기존 FE 343개 테스트 영향 없음 확인
- 프로덕션 빌드 → `dist/sw.js`, `manifest.webmanifest` 생성 확인
