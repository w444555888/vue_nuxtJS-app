// @ts-nocheck
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,
  modules: [
    '@nuxt/image',
    '@nuxt/ui',
    '@ant-design-vue/nuxt',
    '@pinia/nuxt'
  ],
  components: true,
  runtimeConfig: {
    public: {
      apiBase: process.env.API_BASE || 'http://localhost:3001',
      socketUrl: process.env.SOCKET_URL || 'http://localhost:3001'
    }
  }
})