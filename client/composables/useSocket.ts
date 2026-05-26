import { ref } from 'vue'
import { io, Socket } from 'socket.io-client'

const socketRef = ref<Socket | null>(null)
const isConnectedRef = ref(false)

export const useSocket = () => {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()

  const socketUrl = config.public.socketUrl || 'http://127.0.0.1:3001'

  // 初始化 Socket 連接 
  const initSocket = () => {
    if (socketRef.value) {
      return
    }

    // 使用 token 進行身份驗證，並設置重連選項
    socketRef.value = io(socketUrl, {
      auth: {
        token: authStore.token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    })

    socketRef.value.on('connect', () => {
      isConnectedRef.value = true
      console.log('Socket 已連接')
    })

    socketRef.value.on('disconnect', () => {
      isConnectedRef.value = false
      console.log('Socket 已斷開')
    })

    socketRef.value.on('error', (error: any) => {
      console.error('Socket 錯誤:', error)
    })
  }

  // 斷開 Socket 連接
  const disconnectSocket = () => {
    if (socketRef.value) {
      socketRef.value.disconnect()
      socketRef.value = null
      isConnectedRef.value = false
    }
  }

  // 加入聊天室
  const joinRoom = (userId: number, roomId: number) => {
    if (socketRef.value) {
      socketRef.value.emit('join_room', { userId, roomId })
    }
  }

  // 發送消息
  const sendMessage = (userId: number, roomId: number, content: string) => {
    if (socketRef.value) {
      socketRef.value.emit('send_message', { userId, roomId, content })
    }
  }

  // 監聽消息
  const onReceiveMessage = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('receive_message', callback)
    }
  }

  // 監聽使用者加入
  const onUserJoined = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('user_joined', callback)
    }
  }

  // 監聽使用者離開
  const onUserLeft = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('user_left', callback)
    }
  }

  // 移除監聽
  const offReceiveMessage = (callback?: (data: any) => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('receive_message', callback)
        return
      }

      socketRef.value.off('receive_message')
    }
  }

  // ==================== 私聊功能 ====================

  // 設置用戶ID（連接時調用）
  const setUserId = (userId: number) => {
    if (socketRef.value) {
      socketRef.value.emit('set_user_id', userId)
    }
  }

  // 加入私聊對話
  const joinPrivateChat = (userId: number, friendId: number) => {
    if (socketRef.value) {
      socketRef.value.emit('join_private_chat', { userId, friendId })
    }
  }

  // 發送私聊消息
  const sendPrivateMessage = (userId: number, friendId: number, content: string) => {
    if (socketRef.value) {
      socketRef.value.emit('send_private_message', { userId, friendId, content })
    }
  }

  // 標記私聊為已讀
  const markPrivateAsRead = (userId: number, friendId: number) => {
    if (socketRef.value) {
      socketRef.value.emit('mark_private_as_read', { userId, friendId })
    }
  }

  // 監聽接收私聊消息
  const onReceivePrivateMessage = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('receive_private_message', callback)
    }
  }

  // 監聽私聊消息接收通知
  const onPrivateMessageReceived = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('private_message_received', callback)
    }
  }

  // 監聽私聊消息被標記為已讀
  const onPrivateMessagesRead = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('private_messages_read', callback)
    }
  }

  // 移除私聊監聽
  const offReceivePrivateMessage = (callback?: (data: any) => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('receive_private_message', callback)
        return
      }

      socketRef.value.off('receive_private_message')
    }
  }

  const offPrivateMessageReceived = (callback?: (data: any) => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('private_message_received', callback)
        return
      }

      socketRef.value.off('private_message_received')
    }
  }

  const offPrivateMessagesRead = (callback?: (data: any) => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('private_messages_read', callback)
        return
      }

      socketRef.value.off('private_messages_read')
    }
  }

  return {
    socket: socketRef,
    isConnected: isConnectedRef,
    initSocket,
    disconnectSocket,
    joinRoom,
    sendMessage,
    onReceiveMessage,
    onUserJoined,
    onUserLeft,
    offReceiveMessage,
    setUserId,
    joinPrivateChat,
    sendPrivateMessage,
    markPrivateAsRead,
    onReceivePrivateMessage,
    onPrivateMessageReceived,
    onPrivateMessagesRead,
    offReceivePrivateMessage,
    offPrivateMessageReceived,
    offPrivateMessagesRead
  }
}
