import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['pwa-icon.svg'],
      manifest: {
        name: '포도가계부 - AI 가계부',
        short_name: '포도가계부',
        description: '포도알처럼 하나씩, 알찬 가계부',
        theme_color: '#7c3aed',
        background_color: '#fefce8',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: 'pwa-64x64.png',
            sizes: '64x64',
            type: 'image/png',
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 캐시 이름 버전 업 → 구 SW 캐시 강제 제거 (API 캐시 제거 포함)
        cacheId: 'podo-budget-v3',
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        // API 응답 캐시 제거: 인증 토큰 만료 후에도 캐시된 응답이 반환되는 문제 방지
        runtimeCaching: [],
      },
    }),
  ],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        configure: (proxy) => {
          // FastAPI 307 리다이렉트의 Location을 상대경로로 변환
          // → 브라우저가 같은 origin으로 리다이렉트하여 Authorization 헤더 유지
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.statusCode === 307 && proxyRes.headers.location) {
              proxyRes.headers.location = proxyRes.headers.location.replace(
                'http://localhost:8000',
                '',
              )
            }
          })
        },
      },
    },
  },
})
