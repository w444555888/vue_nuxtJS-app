export const useFriendService = () => {
  const { get, post, delete: deleteRequest } = useHttpClient()

  // 獲取好友列表
  const fetchFriends = async () => {
    try {
      const result = await get('/api/friends/list')
      return { success: result.success, data: result.data || [], message: result.message }
    } catch (error: any) {
      console.error('❌ 獲取好友列表失敗:', error)
      return { success: false, data: [], error: error.message, message: error.message }
    }
  }

  // 發送好友請求
  const sendFriendRequest = async (receiverEmail: string) => {
    try {
      const result = await post('/api/friends/request/send', { receiverEmail })
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('❌ 發送好友請求失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 獲取待處理的好友請求
  const fetchPendingRequests = async () => {
    try {
      const result = await get('/api/friends/requests/pending')
      return { success: result.success, data: result.data || [], message: result.message }
    } catch (error: any) {
      console.error('❌ 獲取好友請求失敗:', error)
      return { success: false, data: [], error: error.message, message: error.message }
    }
  }

  // 接受好友請求
  const acceptFriendRequest = async (requestId: number) => {
    try {
      const result = await post(`/api/friends/request/accept/${requestId}`, {})
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('❌ 接受好友請求失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 拒絕好友請求
  const rejectFriendRequest = async (requestId: number) => {
    try {
      const result = await post(`/api/friends/request/reject/${requestId}`, {})
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('❌ 拒絕好友請求失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 刪除好友
  const removeFriend = async (friendId: number) => {
    try {
      const result = await deleteRequest(`/api/friends/${friendId}`)
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('❌ 刪除好友失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  return {
    fetchFriends,
    sendFriendRequest,
    fetchPendingRequests,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend
  }
}
