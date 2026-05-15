/**
 * 錯誤處理組合函數
 */

export const useErrorHandler = () => {
  const router = useRouter()
  const error = useError()

  /**
   * 處理錯誤 - 記錄錯誤、顯示錯誤頁面或重定向
   */
  const handleError = (err: any, options?: { fatal?: boolean; redirect?: string }) => {
    const { fatal = false, redirect } = options || {}

    // 記錄錯誤
    console.error('Error:', err)

    // 如果是致命錯誤，顯示錯誤頁面
    if (fatal) {
      throw createError({
        status: err.status || 500,
        statusText: err.statusText || 'Internal Server Error',
        message: err.message || '發生了一個錯誤',
        fatal: true,
      })
    }

    // 如果指定重定向，跳轉到指定頁面
    if (redirect) {
      router.push(redirect)
    }
  }

  /**
   * 處理 API 錯誤
   */
  const handleApiError = (err: any) => {
    if (err.response?.status === 401) {
      // 未授權，重定向到登錄頁面
      router.push('/login')
      return
    }

    if (err.response?.status === 403) {
      handleError(err, { fatal: true })
      return
    }

    if (err.response?.status === 404) {
      handleError(err, { redirect: '/' })
      return
    }

    if (err.response?.status >= 500) {
      handleError(err, { fatal: true })
      return
    }

    // 其他错误
    console.warn('API Error:', err.response?.data || err.message)
  }

  /**
   * 清除错误
   */
  const clearAppError = async (redirect?: string) => {
    await clearError({ redirect })
  }

  return {
    error,
    handleError,
    handleApiError,
    clearAppError,
  }
}
