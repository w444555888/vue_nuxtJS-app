import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null)
  const token = ref<string | null>(null)
  const isAuthenticated = computed(() => !!token.value)
  const isLoading = ref(false)

  // 初始化：从本地存储读取
  const initAuth = () => {
    const storedToken = localStorage.getItem('auth_token')
    const storedUser = localStorage.getItem('auth_user')
    
    if (storedToken) {
      token.value = storedToken
    }
    
    if (storedUser) {
      user.value = JSON.parse(storedUser)
    }
  }

  // 设置用户和 Token
  const setAuth = (newUser: any, newToken: string) => {
    user.value = newUser
    token.value = newToken
    localStorage.setItem('auth_token', newToken)
    localStorage.setItem('auth_user', JSON.stringify(newUser))
  }

  // 清除认证
  const clearAuth = () => {
    user.value = null
    token.value = null
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_user')
  }

  // 设置加载状态
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  return {
    user,
    token,
    isAuthenticated,
    isLoading,
    initAuth,
    setAuth,
    clearAuth,
    setLoading
  }
})
