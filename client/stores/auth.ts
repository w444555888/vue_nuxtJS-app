import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getFromStorage, setToStorage, removeFromStorage } from '~/utils/environment'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null)
  const token = ref<string | null>(null)
  const isAuthenticated = computed(() => !!token.value)
  const isLoading = ref(false)

  // 初始化：从本地存储读取
  const initAuth = () => {
    try {
      const storedToken = getFromStorage('auth_token')
      const storedUser = getFromStorage('auth_user')
      
      if (storedToken) {
        token.value = storedToken
      }
      
      if (storedUser) {
        user.value = JSON.parse(storedUser)
      }
    } catch (error) {
      console.error('Failed to load auth from localStorage:', error)
    }
  }

  // 設定使用者和 Token
  const setAuth = (newUser: any, newToken: string) => {
    user.value = newUser
    token.value = newToken
    
    setToStorage('auth_token', newToken)
    setToStorage('auth_user', JSON.stringify(newUser))
  }

  // 清除認證
  const clearAuth = () => {
    user.value = null
    token.value = null
    
    removeFromStorage('auth_token')
    removeFromStorage('auth_user')
  }

  // 設定載入狀態
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
