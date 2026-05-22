// @ts-nocheck
const apiBase = process.env.API_BASE || 'http://localhost:3001'
const socketUrl = process.env.SOCKET_URL || 'http://localhost:3001'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,
  routeRules: {
    '/chat': { ssr: false },
    '/chat/**': { ssr: false }
  },
  css: ['~/assets/styles/global.css'],
  modules: [
    '@nuxt/image',
    '@nuxt/ui',
    '@ant-design-vue/nuxt',
    '@pinia/nuxt',
    'nuxt-security'
  ],
  security: {
    strict: false,
    nonce: true,  // CSP nonce 一次性隨機碼，每次 Nuxt 渲染時都產生新的
    headers: {
      contentSecurityPolicy: {
        'connect-src': [
          "'self'",
          apiBase,
          socketUrl,
          'https:',
          'wss:',
          'ws:'
        ],
        'img-src': ["'self'", 'data:', 'blob:', 'https:']
      }
    },
    rateLimiter: { // 同一個 IP 每 5 分鐘允許 150 個請求，超過則返回 429 Too Many Requests
      tokensPerInterval: 150,
      interval: 300000,
      headers: false
    },
    requestSizeLimiter: { // 限制請求體大小，超過則返回 413 Payload Too Large
      maxRequestSizeInBytes: 2000000,
      maxUploadFileRequestInBytes: 8000000,
      throwError: true
    }
  },
  components: true, //自動匯入
  // 頁面轉場配置
  app: {
    pageTransition: {
      name: 'fade',
      mode: 'out-in'
    }
  },
  runtimeConfig: {
    public: {
      apiBase,
      socketUrl
    }
  }
})