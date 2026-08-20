import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { getFromStorage, setToStorage, removeFromStorage } from '~/utils/environment'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<any>(null)
  const token = ref<string | null>(null)
  const isAuthenticated = computed(() => !!token.value)
  const isLoading = ref(false)

  // 主要在處理啟動後的登入恢復流程
  const hasBootstrapped = ref(false) // 是否已完成
  const isBootstrapping = ref(false) // 目前是否正在執行 bootstrapAuth（進行中旗標）
  let bootstrapPromise: Promise<boolean> | null = null  // 正在執行的 bootstrapAuth Promise，讓並發呼叫共用同一個結果，避免重複打 refresh API

  // 初始化認證狀態，讀取使用者資料
  const initAuth = () => {
    try {
      const storedUser = getFromStorage('auth_user')
      
      if (storedUser) {
        user.value = JSON.parse(storedUser)
      }
    } catch (error) {
      console.error('Failed to load auth from localStorage:', error)
    }
  }

  // 設定使用者和 Access Token
  const setAuth = (newUser: any, newToken: string) => {
    user.value = newUser
    token.value = newToken

    setToStorage('auth_user', JSON.stringify(newUser))
  }

  // 只更新使用者資料（例如更新頭像/名稱），並同步到本地存儲
  const setUser = (newUser: any) => {
    user.value = newUser
    setToStorage('auth_user', JSON.stringify(newUser))
  }

  // 更新 Access Token
  const updateAccessToken = (newToken: string) => {
    token.value = newToken
  }

  // 清除認證
  const clearAuth = () => {
    user.value = null
    token.value = null

    removeFromStorage('auth_user')
    hasBootstrapped.value = true
    bootstrapPromise = null
  }

  // 登入狀態恢復機制
  const bootstrapAuth = async (): Promise<boolean> => {
    if (token.value) {
      hasBootstrapped.value = true
      return true
    }

    if (isBootstrapping.value && bootstrapPromise) {
      return bootstrapPromise
    }

    const { refreshSession } = useAuthService()

    bootstrapPromise = (async () => {
      isBootstrapping.value = true

      try {
        const response = await refreshSession()

        if (response?.success && response?.data?.accessToken) {
          token.value = response.data.accessToken

          if (response.data.user) {
            user.value = response.data.user
            setToStorage('auth_user', JSON.stringify(response.data.user))
          }

          hasBootstrapped.value = true
          return true
        }

        token.value = null
        hasBootstrapped.value = true
        return false
      } catch {
        token.value = null
        hasBootstrapped.value = true
        return false
      } finally {
        isBootstrapping.value = false
      }
    })()

    const result = await bootstrapPromise
    bootstrapPromise = null
    return result
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
    hasBootstrapped,
    isBootstrapping,
    initAuth,
    bootstrapAuth,
    setAuth,
    setUser,
    updateAccessToken,
    clearAuth,
    setLoading
  }
})
