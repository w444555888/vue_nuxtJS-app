export const useAuthService = () => {
  const { post } = useHttpClient()
  const authStore = useAuthStore()
  const router = useRouter()

  // 注册
  const register = async (email: string, username: string, password: string) => {
    try {
      authStore.setLoading(true)
      const result = await post('/api/auth/register', {
        email,
        username,
        password
      })

      if (result.success) {
        authStore.setAuth(result.data.user, result.data.token)
        return { success: true, data: result.data, message: result.message }
      } else {
        return { success: false, message: result.message || result.error || '註冊失敗，請重試' }
      }
    } catch (error: any) {
      console.error('註冊失敗:', error)
      return { 
        success: false, 
        error: error.message || error.error || '註冊失敗，請重試' 
      }
    } finally {
      authStore.setLoading(false)
    }
  }

  // 登入
  const login = async (email: string, password: string) => {
    try {
      authStore.setLoading(true)
      const result = await post('/api/auth/login', {
        email,
        password
      })

      if (result.success) {
        authStore.setAuth(result.data.user, result.data.token)
        return { success: true, data: result.data, message: result.message }
      } else {
        return { success: false, message: result.message || result.error || '登入失敗，請检查郵箱和密碼' }
      }
    } catch (error: any) {
      console.error('登入失敗:', error)
      return { 
        success: false, 
        error: error.message || error.error || '登入失敗，請检查郵箱和密碼'
      }
    } finally {
      authStore.setLoading(false)
    }
  }

  // 登出
  const logout = () => {
    authStore.clearAuth()
    router.push('/login')
  }

  return { register, login, logout }
}
