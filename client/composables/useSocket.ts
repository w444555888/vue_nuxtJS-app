import { ref, onMounted, onUnmounted } from 'vue'
import { io, Socket } from 'socket.io-client'

export const useSocket = () => {
  const socket = ref<Socket | null>(null)
  const isConnected = ref(false)
  const authStore = useAuthStore()
  const config = useRuntimeConfig()

  const socketUrl = config.public.socketUrl || 'http://localhost:3001'

  // 初始化 Socket 连接
  const initSocket = () => {
    if (socket.value) return

    socket.value = io(socketUrl, {
      auth: {
        token: authStore.token
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    })

    socket.value.on('connect', () => {
      isConnected.value = true
      console.log('✅ Socket 已连接')
    })

    socket.value.on('disconnect', () => {
      isConnected.value = false
      console.log('❌ Socket 已断开')
    })

    socket.value.on('error', (error: any) => {
      console.error('❌ Socket 错误:', error)
    })
  }

  // 断开 Socket 连接
  const disconnectSocket = () => {
    if (socket.value) {
      socket.value.disconnect()
      socket.value = null
      isConnected.value = false
    }
  }

  // 加入聊天室
  const joinRoom = (userId: number, roomId: number) => {
    if (socket.value) {
      socket.value.emit('join_room', { userId, roomId })
    }
  }

  // 发送消息
  const sendMessage = (userId: number, roomId: number, content: string) => {
    if (socket.value) {
      socket.value.emit('send_message', { userId, roomId, content })
    }
  }

  // 监听消息
  const onReceiveMessage = (callback: (data: any) => void) => {
    if (socket.value) {
      socket.value.on('receive_message', callback)
    }
  }

  // 监听用户加入
  const onUserJoined = (callback: (data: any) => void) => {
    if (socket.value) {
      socket.value.on('user_joined', callback)
    }
  }

  // 监听用户离开
  const onUserLeft = (callback: (data: any) => void) => {
    if (socket.value) {
      socket.value.on('user_left', callback)
    }
  }

  // 移除监听
  const offReceiveMessage = () => {
    if (socket.value) {
      socket.value.off('receive_message')
    }
  }

  return {
    socket,
    isConnected,
    initSocket,
    disconnectSocket,
    joinRoom,
    sendMessage,
    onReceiveMessage,
    onUserJoined,
    onUserLeft,
    offReceiveMessage
  }
}
