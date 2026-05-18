export const useAiService = () => {
  const { post } = useHttpClient()
  const router = useRouter()

  // 發送消息到 AI 客服
  const sendMessage = async (message: string) => {
    try {
      // 驗證消息內容
      if (!message || message.trim().length === 0) {
        return { 
          success: false, 
          error: '消息不能為空',
          message: '請輸入您的問題'
        }
      }

      if (message.length > 1000) {
        return { 
          success: false, 
          error: '消息過長',
          message: '消息不能超過 1000 個字符'
        }
      }

      const result = await post('/api/ai/chat', {
        message: message.trim()
      })

      return {
        success: result.success,
        data: result.data,
        message: result.message
      }
    } catch (error: any) {
      console.error('AI 客服通訊失敗:', error)
      
      // 檢查是否為認證錯誤
      if (error.response?.status === 401) {
        router.push('/login')
        return {
          success: false,
          error: '認證失敗',
          message: '請重新登入'
        }
      }

      return {
        success: false,
        error: error.message || 'AI 客服暫時不可用',
        message: error.message || '請稍後再試'
      }
    }
  }

  return {
    sendMessage
  }
}
