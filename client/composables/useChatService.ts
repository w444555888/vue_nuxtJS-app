export const useChatService = () => {
  const { get, post, delete: deleteRequest } = useHttpClient()
  const chatStore = useChatStore()

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
      console.error('❌ 获取聊天室失败:', error)
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
      console.error('❌ 建立聊天室失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 删除聊天室
  const deleteRoom = async (roomId: number) => {
    try {
      const result = await deleteRequest(`/api/chat/rooms/${roomId}`)
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('❌ 删除聊天室失败:', error)
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
      console.error('❌ 邀请好友失败:', error)
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
      console.error('❌ 获取消息失败:', error)
      return { success: false, error }
    } finally {
      chatStore.setLoading(false)
    }
  }

  return {
    fetchRooms,
    createRoom,
    deleteRoom,
    inviteFriendsToRoom,
    fetchMessages
  }
}
