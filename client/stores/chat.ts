import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useChatStore = defineStore('chat', () => {
  const rooms = ref<any[]>([])
  const currentRoom = ref<any>(null)
  const messages = ref<any[]>([])
  const onlineUsers = ref<any[]>([])
  const isLoading = ref(false)

  // 计算属性
  const currentRoomMessages = computed(() => messages.value)
  
  const hasUnreadMessages = computed(() => {
    return rooms.value.some((room: any) => room.unreadCount > 0)
  })

  // 設定聊天室列表
  const setRooms = (newRooms: any[]) => {
    rooms.value = newRooms
  }

  // 新增或更新聊天室
  const updateRoom = (room: any) => {
    const index = rooms.value.findIndex((r) => r.id === room.id)
    if (index >= 0) {
      rooms.value[index] = { ...rooms.value[index], ...room }
    } else {
      rooms.value.push(room)
    }
  }

  // 設定當前聊天室
  const setCurrentRoom = (room: any) => {
    currentRoom.value = room
    messages.value = [] // 清空消息
  }

  // 設定訊息
  const setMessages = (newMessages: any[]) => {
    messages.value = newMessages
  }

  // 新增訊息
  const addMessage = (message: any) => {
    messages.value.push(message)
    
    // 更新当前房间的最后消息
    if (currentRoom.value && currentRoom.value.id === message.roomId) {
      currentRoom.value.lastMessage = message.content
      currentRoom.value.lastMessageTime = message.createdAt || message.timestamp
    }
  }

  // 新增多条訊息
  const addMessages = (newMessages: any[]) => {
    messages.value.push(...newMessages)
  }

  // 清空消息
  const clearMessages = () => {
    messages.value = []
  }

  // 設定線上使用者
  const setOnlineUsers = (users: any[]) => {
    onlineUsers.value = users
  }

  // 新增線上使用者
  const addOnlineUser = (user: any) => {
    const exists = onlineUsers.value.some((u) => u.id === user.id)
    if (!exists) {
      onlineUsers.value.push(user)
    }
  }

  // 移除線上使用者
  const removeOnlineUser = (userId: number) => {
    onlineUsers.value = onlineUsers.value.filter((u) => u.id !== userId)
  }

  // 設定載入狀態
  const setLoading = (loading: boolean) => {
    isLoading.value = loading
  }

  // 标记房间为已读
  const markRoomAsRead = (roomId: number) => {
    const room = rooms.value.find((r) => r.id === roomId)
    if (room) {
      room.unreadCount = 0
    }
  }

  // 增加未读消息数
  const incrementUnreadCount = (roomId: number) => {
    const room = rooms.value.find((r) => r.id === roomId)
    if (room) {
      room.unreadCount = (room.unreadCount || 0) + 1
    }
  }

  return {
    rooms,
    currentRoom,
    messages,
    onlineUsers,
    isLoading,
    currentRoomMessages,
    hasUnreadMessages,
    setRooms,
    updateRoom,
    setCurrentRoom,
    setMessages,
    addMessage,
    addMessages,
    clearMessages,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    setLoading,
    markRoomAsRead,
    incrementUnreadCount
  }
})
