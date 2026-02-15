/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './contexts/ToastContext'
import { AuthProvider } from './contexts/AuthContext'
import { initSentry, getErrorBoundary } from './utils/sentry'
import './index.css'
import App from './App.tsx'

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

  const ErrorBoundary = getErrorBoundary()

  const appTree = (
    <StrictMode>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
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
