export const useChatService = () => {
  const { get, post, patch, delete: deleteRequest } = useHttpClient()
  const chatStore = useChatStore()

  // ==================== 群組聊天室功能 ====================

  // 获取聊天室列表
  const fetchRooms = async () => {
    try {
      chatStore.setLoading(true)
      const result = await get('/api/chat/rooms')
      const rooms = result.data || []
      
      // 添加未读消息数
      const roomsWithUnread = rooms.map((room: any) => ({
        ...room,
        unreadCount: 0
      }))
      
      chatStore.setRooms(roomsWithUnread)
      return { success: result.success, data: rooms }
    } catch (error: any) {
      console.error('獲取聊天室失敗:', error)
      return { success: false, error }
    } finally {
      chatStore.setLoading(false)
    }
  }

  // 建立聊天室
  const createRoom = async (name: string, description: string = '') => {
    try {
      const result = await post('/api/chat/rooms', { name, description })
      const room = result.data
      
      chatStore.updateRoom({ ...room, unreadCount: 0 })
      return { success: result.success, data: room, message: result.message }
    } catch (error: any) {
      console.error('建立聊天室失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 删除聊天室
  const deleteRoom = async (roomId: number) => {
    try {
      const result = await deleteRequest(`/api/chat/rooms/${roomId}`)
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('刪除聊天室失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 编辑聊天室
  const updateRoom = async (roomId: number, data: { name?: string; description?: string }) => {
    try {
      const result = await patch(`/api/chat/rooms/${roomId}`, data)
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('編輯聊天室失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 邀请好友加入聊天室
  const inviteFriendsToRoom = async (roomId: number, friendIds: number[]) => {
    try {
      const result = await post(`/api/chat/rooms/${roomId}/invite`, { 
        friendIds 
      })
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('邀请好友失败:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 获取聊天室消息
  const fetchMessages = async (roomId: number) => {
    try {
      chatStore.setLoading(true)
      const result = await get(`/api/chat/rooms/${roomId}/messages`)
      const messages = result.data || []
      
      // 转换消息格式
      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        userId: msg.user.id,
        username: msg.user.username,
        avatar: msg.user.avatar,
        roomId: msg.roomId,
        timestamp: msg.createdAt,
        createdAt: msg.createdAt
      }))
      
      chatStore.setMessages(formattedMessages)
      return { success: result.success, data: formattedMessages }
    } catch (error: any) {
      console.error('獲取消息失敗:', error)
      return { success: false, error }
    } finally {
      chatStore.setLoading(false)
    }
  }

  // 發送聊天室消息
  const sendMessage = async (roomId: number, content: string) => {
    try {
      const result = await post(`/api/chat/rooms/${roomId}/messages`, { content })
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('發送消息失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 編輯聊天室消息
  const editMessage = async (roomId: number, messageId: number, content: string) => {
    try {
      const result = await patch(`/api/chat/rooms/${roomId}/messages/${messageId}`, { content })
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('編輯消息失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 刪除聊天室消息
  const deleteMessage = async (roomId: number, messageId: number) => {
    try {
      const result = await deleteRequest(`/api/chat/rooms/${roomId}/messages/${messageId}`)
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('刪除消息失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // ==================== 私聊功能 ====================

  // 獲取所有私聊對話列表
  const fetchPrivateConversations = async () => {
    try {
      const result = await get('/api/chat/private-conversations')
      const conversations = result.data || []
      return { success: result.success, data: conversations }
    } catch (error: any) {
      console.error('獲取私聊對話失敗:', error)
      return { success: false, error }
    }
  }

  // 獲取與特定好友的私聊消息
  const fetchPrivateMessages = async (friendId: number) => {
    try {
      const result = await get(`/api/chat/private/${friendId}`)
      if (!result.success || !result.data) {
        console.error('API 返回失敗:', result)
        return { success: false, error: result.message || '獲取失敗', data: null }
      }
      
      const { friend, messages } = result.data
    
      if (!friend || !messages) {
        console.error('無效的返回數據:', result.data)
        return { success: false, error: '返回數據格式不正確', data: null }
      }
      
      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        senderId: msg.sender.id,
        senderName: msg.sender.username,
        senderAvatar: msg.sender.avatar,
        receiverId: msg.receiver.id,
        isRead: msg.isRead,
        createdAt: msg.createdAt,
        timestamp: msg.createdAt
      }))
      
      return { success: result.success, data: { friend, messages: formattedMessages } }
    } catch (error: any) {
      console.error('獲取私聊消息失敗:', error)
      return { success: false, error: error.message || '網路錯誤', data: null }
    }
  }

  // 發送私聊消息
  const sendPrivateMessage = async (friendId: number, content: string) => {
    try {
      const result = await post(`/api/chat/private/${friendId}/messages`, { content })
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('發送私聊失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 標記私聊為已讀
  const markPrivateAsRead = async (friendId: number) => {
    try {
      const result = await patch(`/api/chat/private/${friendId}/mark-read`, {})
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('標記已讀失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  return {
    fetchRooms,
    createRoom,
    deleteRoom,
    updateRoom,
    inviteFriendsToRoom,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    fetchPrivateConversations,
    fetchPrivateMessages,
    sendPrivateMessage,
    markPrivateAsRead
  }
}
