export const useChatService = () => {
  const { $fetch } = useApi()
  const chatStore = useChatStore()

  // 获取聊天室列表
  const fetchRooms = async () => {
    try {
      chatStore.setLoading(true)
      const rooms = await $fetch('/api/chat/rooms')
      
      // 添加未读消息数
      const roomsWithUnread = rooms.map((room: any) => ({
        ...room,
        unreadCount: 0
      }))
      
      chatStore.setRooms(roomsWithUnread)
      return { success: true, data: rooms }
    } catch (error: any) {
      console.error('❌ 获取聊天室失败:', error)
      return { success: false, error }
    } finally {
      chatStore.setLoading(false)
    }
  }

  // 创建聊天室
  const createRoom = async (name: string, description: string = '') => {
    try {
      const room = await $fetch('/api/chat/rooms', {
        method: 'POST',
        body: { name, description }
      })
      
      chatStore.updateRoom({ ...room, unreadCount: 0 })
      return { success: true, data: room }
    } catch (error: any) {
      console.error('❌ 创建聊天室失败:', error)
      return { success: false, error }
    }
  }

  // 获取聊天室消息
  const fetchMessages = async (roomId: number) => {
    try {
      chatStore.setLoading(true)
      const messages = await $fetch(`/api/chat/rooms/${roomId}/messages`)
      
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
      return { success: true, data: formattedMessages }
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
    fetchMessages
  }
}
