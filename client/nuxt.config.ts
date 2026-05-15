// @ts-nocheck
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,
  css: ['~/assets/styles/global.css'],
  modules: [
    '@nuxt/image',
    '@nuxt/ui',
    '@ant-design-vue/nuxt',
    '@pinia/nuxt'
  ],
  components: true,
  // 頁面轉場配置
  app: {
    pageTransition: {
      name: 'fade',
      mode: 'out-in'
    }
  },
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:3001',
      socketUrl: process.env.SOCKET_URL || 'http://localhost:3001'
    }
  }
})