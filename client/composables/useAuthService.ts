export const useAuthService = () => {
  const { $fetch } = useApi()
  const authStore = useAuthStore()
  const router = useRouter()

  // 注册
  const register = async (email: string, username: string, password: string) => {
    try {
      authStore.setLoading(true)
      const response = await $fetch('/api/auth/register', {
        method: 'POST',
        body: { email, username, password }
      })

      authStore.setAuth(response.user, response.token)
      return { success: true, data: response }
    } catch (error: any) {
      console.error('❌ 注册失败:', error)
      return { 
        success: false, 
        error: error.data?.error || '注册失败，请重试' 
      }
    } finally {
      authStore.setLoading(false)
    }
  }

  // 登入
  const login = async (email: string, password: string) => {
    try {
      authStore.setLoading(true)
      const response = await $fetch('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })

      authStore.setAuth(response.user, response.token)
      return { success: true, data: response }
    } catch (error: any) {
      console.error('❌ 登入失败:', error)
      return { 
        success: false, 
        error: error.data?.error || '登入失败，请检查邮箱和密码' 
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
