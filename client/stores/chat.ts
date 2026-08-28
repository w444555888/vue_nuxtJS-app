import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

type RoomId = number

type ChatRoom = {
  id: number
  name?: string
  description?: string
  memberCount?: number
  creatorId?: number
  unreadCount?: number
  lastMessage?: string
  lastMessageTime?: string
  members?: Array<{
    id: number
    username?: string
    avatar?: string
  }>
}

type RoomMessage = {
  id: number
  seq?: number
  roomId?: number
  content?: string
  imageUrl?: string | null
  replyToMessageId?: number | null
  replyPreview?: {
    id: number
    content: string
    imageUrl?: string | null
    senderId?: number
    senderName: string
  } | null
  userId?: number
  username?: string
  avatar?: string
  createdAt?: string
  timestamp?: string
}

type PrivateMessage = {
  id: number
  seq?: number
  content?: string
  imageUrl?: string | null
  replyToMessageId?: number | null
  replyPreview?: {
    id: number
    content: string
    imageUrl?: string | null
    senderId?: number
    senderName: string
  } | null
  senderId?: number
  senderName?: string
  senderAvatar?: string
  receiverId?: number
  isRead?: boolean
  createdAt?: string
  timestamp?: string
}

type OnlineUser = {
  id: number
  username?: string
  avatar?: string
}

const isPositiveInteger = (value: unknown): value is number => {
  return Number.isInteger(value) && Number(value) > 0
}

const toRoomKey = (roomId: number) => String(Number(roomId || 0))

const toPrivateConversationKey = (userIdA: number, userIdB: number) => {
  const a = Number(userIdA || 0)
  const b = Number(userIdB || 0)
  return `private_${Math.min(a, b)}_${Math.max(a, b)}`
}

export const useChatStore = defineStore('chat', () => {
  const rooms = ref<ChatRoom[]>([])
  const currentRoom = ref<ChatRoom | null>(null)
  const messages = ref<RoomMessage[]>([])
  const roomMessagesById = ref<Record<string, RoomMessage[]>>({})
  const roomMessageIdSetById = ref<Record<string, Set<number>>>({})
  const privateMessagesByConversation = ref<Record<string, PrivateMessage[]>>({})
  const privateMessageIdSetByConversation = ref<Record<string, Set<number>>>({})
  const onlineUsers = ref<OnlineUser[]>([])
  const isLoading = ref(false)

  const ensureRoomBucket = (roomId: RoomId) => {
    const key = toRoomKey(roomId)

    const messageBucket = (roomMessagesById.value[key] ??= [])
    const idSetBucket = (roomMessageIdSetById.value[key] ??= new Set<number>())

    return {
      key,
      messageBucket,
      idSetBucket
    }
  }

  const ensurePrivateBucket = (currentUserId: number, friendId: number) => {
    const key = toPrivateConversationKey(currentUserId, friendId)

    const messageBucket = (privateMessagesByConversation.value[key] ??= [])
    const idSetBucket = (privateMessageIdSetByConversation.value[key] ??= new Set<number>())

    return {
      key,
      messageBucket,
      idSetBucket
    }
  }

  const syncCurrentRoomMessages = (roomId: RoomId) => {
    if (Number(currentRoom.value?.id) !== Number(roomId)) {
      return
    }

    const { messageBucket } = ensureRoomBucket(roomId)
    messages.value = messageBucket
  }

  // 計算屬性
  const currentRoomMessages = computed(() => {
    const roomId = Number(currentRoom.value?.id)
    if (!Number.isInteger(roomId) || roomId <= 0) {
      return messages.value
    }

    const { messageBucket } = ensureRoomBucket(roomId)
    return messageBucket
  })
  
  const hasUnreadMessages = computed(() => {
    return rooms.value.some((room) => Number(room.unreadCount || 0) > 0)
  })

  // 設定聊天室列表
  const setRooms = (newRooms: ChatRoom[]) => {
    rooms.value = newRooms
  }

  // 新增或更新聊天室
  const updateRoom = (room: Partial<ChatRoom> & { id: number }) => {
    const index = rooms.value.findIndex((r) => r.id === room.id)
    if (index >= 0) {
      rooms.value[index] = { ...rooms.value[index], ...room }
    } else {
      rooms.value.push(room)
    }
  }

  // 設定當前聊天室
  const setCurrentRoom = (room: ChatRoom | null) => {
    currentRoom.value = room

    const roomId = Number(room?.id)
    if (!Number.isInteger(roomId) || roomId <= 0) {
      messages.value = []
      return
    }

    const { messageBucket } = ensureRoomBucket(roomId)
    messages.value = messageBucket
  }

  const getRoomMessages = <TMessage extends RoomMessage = RoomMessage>(roomId: RoomId): TMessage[] => {
    const { messageBucket } = ensureRoomBucket(roomId)
    return messageBucket as TMessage[]
  }

  const setRoomMessages = <TMessage extends RoomMessage>(roomId: RoomId, newMessages: TMessage[]) => {
    const { key } = ensureRoomBucket(roomId)
    const normalizedMessages = (Array.isArray(newMessages) ? newMessages : []) as RoomMessage[]

    roomMessagesById.value[key] = normalizedMessages
    roomMessageIdSetById.value[key] = new Set(
      normalizedMessages
        .map((item) => Number(item?.id))
        .filter((id): id is number => isPositiveInteger(id))
    )

    syncCurrentRoomMessages(roomId)
  }

  const hasRoomMessage = (roomId: RoomId, messageId: number) => {
    const parsedMessageId = Number(messageId)
    if (!isPositiveInteger(parsedMessageId)) {
      return false
    }

    const { idSetBucket } = ensureRoomBucket(roomId)
    return idSetBucket.has(parsedMessageId)
  }

  const addRoomMessage = <TMessage extends RoomMessage>(roomId: RoomId, newMessage: TMessage) => {
    const parsedMessageId = Number(newMessage?.id)
    if (!isPositiveInteger(parsedMessageId)) {
      return false
    }

    const { messageBucket, idSetBucket } = ensureRoomBucket(roomId)
    if (idSetBucket.has(parsedMessageId)) {
      return false
    }

    messageBucket.push(newMessage)
    idSetBucket.add(parsedMessageId)
    syncCurrentRoomMessages(roomId)
    return true
  }

  const updateRoomMessage = (roomId: RoomId, messageId: number, patch: Partial<RoomMessage>) => {
    const parsedMessageId = Number(messageId)
    if (!isPositiveInteger(parsedMessageId)) {
      return false
    }

    const { messageBucket } = ensureRoomBucket(roomId)
    const target = messageBucket.find((item) => Number(item.id) === parsedMessageId)
    if (!target) {
      return false
    }

    Object.assign(target, patch)
    return true
  }

  const removeRoomMessage = (roomId: RoomId, messageId: number) => {
    const parsedMessageId = Number(messageId)
    if (!isPositiveInteger(parsedMessageId)) {
      return false
    }

    const { messageBucket, idSetBucket } = ensureRoomBucket(roomId)
    const index = messageBucket.findIndex((item) => Number(item.id) === parsedMessageId)
    if (index < 0) {
      return false
    }

    messageBucket.splice(index, 1)
    idSetBucket.delete(parsedMessageId)
    syncCurrentRoomMessages(roomId)
    return true
  }

  const clearRoomMessages = (roomId: RoomId) => {
    const { key } = ensureRoomBucket(roomId)
    roomMessagesById.value[key] = []
    roomMessageIdSetById.value[key] = new Set<number>()
    syncCurrentRoomMessages(roomId)
  }

  const getPrivateMessages = <TMessage extends PrivateMessage = PrivateMessage>(
    currentUserId: number,
    friendId: number
  ): TMessage[] => {
    const { messageBucket } = ensurePrivateBucket(currentUserId, friendId)
    return messageBucket as TMessage[]
  }

  const setPrivateMessages = <TMessage extends PrivateMessage>(
    currentUserId: number,
    friendId: number,
    newMessages: TMessage[]
  ) => {
    const { key } = ensurePrivateBucket(currentUserId, friendId)
    const normalizedMessages = (Array.isArray(newMessages) ? newMessages : []) as PrivateMessage[]

    privateMessagesByConversation.value[key] = normalizedMessages
    privateMessageIdSetByConversation.value[key] = new Set(
      normalizedMessages
        .map((item) => Number(item?.id))
        .filter((id): id is number => isPositiveInteger(id))
    )
  }

  const hasPrivateMessage = (currentUserId: number, friendId: number, messageId: number) => {
    const parsedMessageId = Number(messageId)
    if (!isPositiveInteger(parsedMessageId)) {
      return false
    }

    const { idSetBucket } = ensurePrivateBucket(currentUserId, friendId)
    return idSetBucket.has(parsedMessageId)
  }

  const addPrivateMessage = <TMessage extends PrivateMessage>(
    currentUserId: number,
    friendId: number,
    newMessage: TMessage
  ) => {
    const parsedMessageId = Number(newMessage?.id)
    if (!isPositiveInteger(parsedMessageId)) {
      return false
    }

    const { messageBucket, idSetBucket } = ensurePrivateBucket(currentUserId, friendId)
    if (idSetBucket.has(parsedMessageId)) {
      return false
    }

    messageBucket.push(newMessage)
    idSetBucket.add(parsedMessageId)
    return true
  }

  const updatePrivateMessage = (
    currentUserId: number,
    friendId: number,
    messageId: number,
    patch: Partial<PrivateMessage>
  ) => {
    const parsedMessageId = Number(messageId)
    if (!isPositiveInteger(parsedMessageId)) {
      return false
    }

    const { messageBucket } = ensurePrivateBucket(currentUserId, friendId)
    const target = messageBucket.find((item) => Number(item.id) === parsedMessageId)
    if (!target) {
      return false
    }

    Object.assign(target, patch)
    return true
  }

  const removePrivateMessage = (currentUserId: number, friendId: number, messageId: number) => {
    const parsedMessageId = Number(messageId)
    if (!isPositiveInteger(parsedMessageId)) {
      return false
    }

    const { messageBucket, idSetBucket } = ensurePrivateBucket(currentUserId, friendId)
    const index = messageBucket.findIndex((item) => Number(item.id) === parsedMessageId)
    if (index < 0) {
      return false
    }

    messageBucket.splice(index, 1)
    idSetBucket.delete(parsedMessageId)
    return true
  }

  const clearPrivateMessages = (currentUserId: number, friendId: number) => {
    const { key } = ensurePrivateBucket(currentUserId, friendId)
    privateMessagesByConversation.value[key] = []
    privateMessageIdSetByConversation.value[key] = new Set<number>()
  }

  // 設定訊息
  const setMessages = (newMessages: RoomMessage[]) => {
    const roomId = Number(currentRoom.value?.id)
    if (Number.isInteger(roomId) && roomId > 0) {
      setRoomMessages(roomId, newMessages)
      return
    }

    messages.value = Array.isArray(newMessages) ? newMessages : []
  }

  // 新增訊息
  const addMessage = (message: RoomMessage) => {
    const roomId = Number(message?.roomId ?? currentRoom.value?.id)
    if (Number.isInteger(roomId) && roomId > 0) {
      addRoomMessage(roomId, message)
    } else {
      messages.value.push(message)
    }
    
    // 更新当前房间的最后消息
    if (currentRoom.value && currentRoom.value.id === message.roomId) {
      currentRoom.value.lastMessage = String(message.content || '')
      currentRoom.value.lastMessageTime = String(message.createdAt || message.timestamp || '')
    }
  }

  // 新增多条訊息
  const addMessages = (newMessages: RoomMessage[]) => {
    if (!Array.isArray(newMessages) || newMessages.length === 0) {
      return
    }

    const roomId = Number(currentRoom.value?.id)
    if (Number.isInteger(roomId) && roomId > 0) {
      newMessages.forEach((item) => addRoomMessage(roomId, item))
      return
    }

    messages.value.push(...newMessages)
  }

  // 清空消息
  const clearMessages = () => {
    const roomId = Number(currentRoom.value?.id)
    if (Number.isInteger(roomId) && roomId > 0) {
      clearRoomMessages(roomId)
      return
    }

    messages.value = []
  }

  // 設定線上使用者
  const setOnlineUsers = (users: OnlineUser[]) => {
    onlineUsers.value = users
  }

  // 新增線上使用者
  const addOnlineUser = (user: OnlineUser) => {
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

  // 標記聊天室為已讀
  const markRoomAsRead = (roomId: number) => {
    const room = rooms.value.find((r) => r.id === roomId)
    if (room) {
      room.unreadCount = 0
    }
  }

  // 增加未讀訊息數量
  const incrementUnreadCount = (roomId: number) => {
    const room = rooms.value.find((r) => r.id === roomId)
    if (room) {
      room.unreadCount = (room.unreadCount || 0) + 1
    }
  }

  const resetState = () => {
    rooms.value = []
    currentRoom.value = null
    messages.value = []
    roomMessagesById.value = {}
    roomMessageIdSetById.value = {}
    privateMessagesByConversation.value = {}
    privateMessageIdSetByConversation.value = {}
    onlineUsers.value = []
    isLoading.value = false
  }

  return {
    rooms,
    currentRoom,
    messages,
    roomMessagesById,
    roomMessageIdSetById,
    privateMessagesByConversation,
    privateMessageIdSetByConversation,
    onlineUsers,
    isLoading,
    currentRoomMessages,
    hasUnreadMessages,
    setRooms,
    updateRoom,
    setCurrentRoom,
    getRoomMessages,
    setRoomMessages,
    hasRoomMessage,
    addRoomMessage,
    updateRoomMessage,
    removeRoomMessage,
    clearRoomMessages,
    getPrivateMessages,
    setPrivateMessages,
    hasPrivateMessage,
    addPrivateMessage,
    updatePrivateMessage,
    removePrivateMessage,
    clearPrivateMessages,
    toPrivateConversationKey,
    setMessages,
    addMessage,
    addMessages,
    clearMessages,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    setLoading,
    markRoomAsRead,
    incrementUnreadCount,
    resetState
  }
})
