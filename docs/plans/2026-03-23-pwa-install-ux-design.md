# PWA 설치 유도 UX 디자인

## 배경

PWA로 설치하면 접근성이 크게 향상되지만 사용자가 이 옵션을 모르고 지나치는 경우가 많다.
모바일 위주 사용자이므로 iOS Safari 수동 안내가 중요하다.

## 목표

1. 첫 로그인 직후 하단 배너로 PWA 설치 유도
2. 설정 페이지에 "앱 설치" 섹션으로 상시 접근 가능
3. iOS Safari 사용자를 위한 수동 안내 모달

## 구성 요소

### 1. InstallBanner (하단 배너)

- 메인 화면(`/`) 진입 시 하단에 슬라이드업 애니메이션으로 노출
- FloatingActionButton 위에 위치
- 내용: 앱 아이콘 + "포도가계부를 앱으로 설치하세요" + 설치/안내 버튼 + 닫기(X)

**노출 조건:**
- PWA standalone 모드가 아닐 때 (미설치 상태)
- `localStorage['pwa-install-banner-dismissed']`가 없을 때
- 둘 다 충족해야 노출

**플랫폼별 동작:**
- Android (Chrome): `beforeinstallprompt` 이벤트 캡처 → "설치" 버튼 → 네이티브 프롬프트
- iOS (Safari): "설치 방법 보기" 버튼 → iOS 안내 모달 열기
- 데스크톱: Android와 동일 (beforeinstallprompt 지원 브라우저)

**닫기:** X 버튼 → `localStorage`에 dismissed 기록 → 다시 안 보임

### 2. 설정 페이지 "앱으로 설치" 섹션

- 설정 메뉴 목록에 Download 아이콘으로 "앱으로 설치" 항목 추가
- 이미 설치됨 (standalone 모드) → "설치 완료 ✓" 표시, 비활성
- 미설치 → 클릭 시 Android는 네이티브 프롬프트, iOS는 안내 모달

### 3. iOS 안내 모달 (IosInstallGuide)

3단계 시각적 가이드 (텍스트 + 아이콘):
1. Safari 하단 **공유 버튼**(□↑) 탭
2. **"홈 화면에 추가"** 선택
3. **"추가"** 탭

- 모달 형태, 배경 딤 처리
- "확인" 버튼으로 닫기

## 기술 구현

### useInstallPrompt 커스텀 훅

```typescript
function useInstallPrompt() {
  // 상태
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(boolean)  // standalone 감지
  const [isIOS, setIsIOS] = useState(boolean)               // iOS 감지
  const [isBannerDismissed, setIsBannerDismissed] = useState(boolean) // localStorage

  // beforeinstallprompt 이벤트 리스너
  // display-mode: standalone 미디어 쿼리 감지
  // userAgent로 iOS 감지

  // 메서드
  const promptInstall = async () => { ... }  // 네이티브 프롬프트 호출
  const dismissBanner = () => { ... }        // localStorage에 기록

  return { deferredPrompt, isInstalled, isIOS, isBannerDismissed, promptInstall, dismissBanner }
}
```

### 파일 구조

```
frontend/src/
├── hooks/useInstallPrompt.ts          # 커스텀 훅
├── components/InstallBanner.tsx       # 하단 배너
├── components/IosInstallGuide.tsx     # iOS 안내 모달
└── pages/SettingsPage.tsx             # 설정에 "앱으로 설치" 섹션 추가
```

### localStorage 키

- `pwa-install-banner-dismissed`: 배너 닫기 기록 (값: `"true"`)

## 변경 범위

| 영역 | 변경 |
|------|------|
| hooks/useInstallPrompt.ts | 신규 생성 |
| components/InstallBanner.tsx | 신규 생성 |
| components/IosInstallGuide.tsx | 신규 생성 |
| pages/SettingsPage.tsx | "앱으로 설치" 메뉴 항목 추가 |
| components/Layout.tsx | InstallBanner 배치 |
| data/changelogs.ts | 새소식 추가 |
