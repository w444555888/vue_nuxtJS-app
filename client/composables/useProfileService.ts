export const useProfileService = () => {
  const { get, patch } = useHttpClient()
  const authStore = useAuthStore()

  // 獲取個人資料
  const fetchProfile = async () => {
    try {
      const result = await get('/api/profile/me')
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('❌ 獲取個人資料失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 更新個人資料
  const updateProfile = async (
    updateData: {
      username?: string
      email?: string
      avatar?: string
      password?: string
      newPassword?: string
    }
  ) => {
    try {
      const result = await patch('/api/profile/update', updateData)
      
      // 更新本地存儲的用戶信息
      if (result.success && result.data) {
        authStore.user = result.data
      }

      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('❌ 更新個人資料失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  return {
    fetchProfile,
    updateProfile
  }
}
