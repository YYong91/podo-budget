/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { initSentry, getErrorBoundary } from './utils/sentry'
import { initAnalytics } from './utils/analytics'
import './index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,        // 30초 — 탭 복귀 시 캐시 즉시 표시
      gcTime: 5 * 60 * 1000,       // 5분 — 비활성 캐시 유지
      retry: 1,                     // 1회 재시도
      refetchOnWindowFocus: false,  // 포커스 시 자동 refetch 비활성화 (수동 제어)
    },
  },
})

// beforeinstallprompt 이벤트를 React 마운트 전에 캡처 — 늦게 등록하면 이벤트를 놓침
declare global {
  interface Window { __pwaInstallPrompt: Event | null }
}
window.__pwaInstallPrompt = null
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault()
  window.__pwaInstallPrompt = e
})

// Sentry ErrorBoundary 폴백 (Tailwind 로드 실패해도 동작하도록 인라인 스타일)
function SentryFallback() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center', fontFamily: 'sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>오류가 발생했습니다</h1>
      <p style={{ color: '#666' }}>페이지를 새로고침해주세요.</p>
      <button
        onClick={() => window.location.reload()}
        style={{
          marginTop: '1rem',
          padding: '0.5rem 1rem',
          backgroundColor: '#4f46e5',
          color: 'white',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
        }}
      >
        새로고침
      </button>
    </div>
  )
}

// Sentry 초기화 후 앱 렌더링 (DSN 없으면 즉시 렌더링)
async function bootstrap() {
  await initSentry()
  await initAnalytics()

  const ErrorBoundary = getErrorBoundary()

  const appTree = (
    <StrictMode>
      <BrowserRouter>
        <ThemeProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <ToastProvider>
                <App />
                {/* api/client.ts 글로벌 에러 핸들러용 react-hot-toast Toaster (#243) */}
                <Toaster position="top-center" toastOptions={{ duration: 3000 }} />
              </ToastProvider>
            </AuthProvider>
          </QueryClientProvider>
        </ThemeProvider>
      </BrowserRouter>
    </StrictMode>
  )

  createRoot(document.getElementById('root')!).render(
    ErrorBoundary ? (
      <ErrorBoundary fallback={<SentryFallback />}>{appTree}</ErrorBoundary>
    ) : (
      appTree
    ),
  )
}

bootstrap()
