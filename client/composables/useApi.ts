import { ref } from 'vue'

export const useApi = () => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()

  const apiBase = config.public.apiBase || 'http://localhost:3001'

  const $fetch = $fetch.create({
    baseURL: apiBase,
    headers: {
      'Content-Type': 'application/json'
    },
    onRequest({ request, options }) {
      // 添加 Authorization header
      if (authStore.token) {
        const headers = options.headers as any
        headers.Authorization = `Bearer ${authStore.token}`
      }
    },
    onResponseError({ response }) {
      // 处理错误响应
      if (response.status === 401) {
        // Token 过期或无效
        authStore.clearAuth()
        navigateTo('/login')
      }
    }
  })

  return { $fetch, apiBase }
}
