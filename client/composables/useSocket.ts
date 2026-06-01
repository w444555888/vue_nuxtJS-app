import { ref, watch } from 'vue'
import { io, Socket } from 'socket.io-client'

const socketRef = ref<Socket | null>(null)
const isConnectedRef = ref(false)
let lastTokenRef: string | null = null
let isHandlingWsAuthFailure = false

const DEFAULT_ACK_TIMEOUT_MS = 8000

const getConnectedSocket = () => {
  if (socketRef.value && socketRef.value.connected) {
    return socketRef.value
  }
  return null
}

const emitIfConnected = (event: string, payload: any, options?: { volatile?: boolean }) => {
  const socket = getConnectedSocket()
  if (!socket) {
    console.warn(`[Socket] 尚未連線，略過事件: ${event}`)
    return false
  }

  if (options?.volatile) {
    socket.volatile.emit(event, payload)
    return true
  }

  socket.emit(event, payload)
  return true
}

/**
 * 封裝一個帶有 ACK 超時機制的 emit 函數，確保在指定時間內收到服務器的回應，否則視為失敗。
 * @param event - 事件名稱
 * @param payload - 發送的數據
 * @param timeoutMs - ACK 超時時間（默認 8000ms）
 * @returns Promise，成功時解析服務器回應的數據，失敗時拋出錯誤
*/
const emitWithAck = <T = any>(event: string, payload: any, timeoutMs = DEFAULT_ACK_TIMEOUT_MS): Promise<T> => {
  return new Promise((resolve, reject) => {
    const socket = getConnectedSocket()
    if (!socket) {
      reject(new Error('Socket 尚未連接'))
      return
    }

    let finished = false
    const timer = setTimeout(() => {
      if (!finished) {
        finished = true
        reject(new Error(`${event} ACK 超時`))
      }
    }, timeoutMs)

    socket.emit(event, payload, (response: T) => {
      if (finished) {
        return
      }

      finished = true
      clearTimeout(timer)
      resolve(response)
    })
  })
}

export const useSocket = () => {
  const authStore = useAuthStore()
  const config = useRuntimeConfig()
  const router = useRouter()

  const socketUrl = config.public.socketUrl || 'http://127.0.0.1:3001'

  // 初始化 Socket 連接 
  const initSocket = () => {
    const authStore = useAuthStore()
    const currentToken = authStore.token

    // 如果 socket 已存在但 token 變了（登出或切換帳號），斷開並重新連接
    if (socketRef.value && lastTokenRef && lastTokenRef !== currentToken) {
      console.log('[Socket] Token 變化，重新連接...')
      socketRef.value.disconnect()
      socketRef.value = null
    }

    if (socketRef.value) {
      return
    }

    // 使用 token 進行身份驗證，並設置重連選項
    socketRef.value = io(socketUrl, {
      auth: {
        token: currentToken
      },
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    })

    lastTokenRef = currentToken

    socketRef.value.on('connect', () => {
      isConnectedRef.value = true
      console.log(`Socket 已連接 (id=${socketRef.value?.id})`)

      const engine = socketRef.value?.io.engine
      if (engine) {
        console.log(`[Socket] transport=${engine.transport.name}`)
        engine.once('upgrade', () => {
          console.log(`[Socket] transport 升級為 ${engine.transport.name}`)
        })
        engine.once('close', (reason: string) => {
          console.warn(`[Socket] 底層連線關閉: ${reason}`)
        })
      }
    })

    socketRef.value.on('connect_error', (error: any) => {
      isConnectedRef.value = false
      console.error('Socket 連線失敗(connect_error):', error?.message || error)

      // 後端在握手中間件拒絕連線（token 缺失/過期)，走與 HTTP 401 一致的登出流程。
      const errorMessage = String(error?.message || '')
      if (errorMessage.includes('未授權')) {
        console.warn('[Socket] 驗證失敗，將清除登入狀態並導向登入頁')

        if (socketRef.value) {
          socketRef.value.disconnect()
          socketRef.value = null
        }

        if (!isHandlingWsAuthFailure) {
          isHandlingWsAuthFailure = true
          authStore.clearAuth()

          if (router.currentRoute.value.path !== '/login') {
            router.push('/login')
          }

          setTimeout(() => {
            isHandlingWsAuthFailure = false
          }, 300)
        }
      }
    })

    socketRef.value.on('disconnect', (reason: string) => {
      isConnectedRef.value = false
      console.log(`Socket 已斷開，原因: ${reason}`)

      if (reason === 'io server disconnect') {
        console.warn('[Socket] 伺服器主動斷線，如需重連請手動呼叫 initSocket/socket.connect()')
      }
    })

    socketRef.value.on('error', (error: any) => {
      console.error('Socket 錯誤:', error)
    })

    socketRef.value.io.on('reconnect_attempt', (attempt: number) => {
      console.warn(`[Socket] 嘗試重連 (${attempt})`)
    })

    socketRef.value.io.on('reconnect', (attempt: number) => {
      console.log(`[Socket] 重連成功 (attempt=${attempt})`)
    })

    socketRef.value.io.on('reconnect_error', (error: any) => {
      console.error('[Socket] 重連失敗:', error?.message || error)
    })

    socketRef.value.io.on('reconnect_failed', () => {
      console.error('[Socket] 已達重連上限，停止重連')
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
  const joinRoom = (userId: number, roomId: number, lastSeq: number = 0) => {
    emitIfConnected('join_room', { userId, roomId, lastSeq })
  }

  // 離開聊天室
  const leaveRoom = (roomId: number) => {
    emitIfConnected('leave_room', { roomId })
  }

  // 發送消息（ACK）
  const sendMessage = async (userId: number, roomId: number, content: string) => {
    return emitWithAck<{ success: boolean; message?: string; event?: any }>('send_message', { userId, roomId, content })
  }

  // 編輯消息（ACK）
  const updateMessage = async (roomId: number, messageId: number, content: string) => {
    return emitWithAck<{ success: boolean; message?: string; event?: any }>('update_message', { roomId, messageId, content })
  }

  // 刪除消息（ACK）
  const deleteMessage = async (roomId: number, messageId: number) => {
    return emitWithAck<{ success: boolean; message?: string; event?: any }>('delete_message', { roomId, messageId })
  }

  // 監聽消息
  const onReceiveMessage = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('receive_message', callback)
    }
  }

  const onRoomMissedMessages = (callback: (data: any[]) => void) => {
    if (socketRef.value) {
      socketRef.value.on('room_missed_messages', callback)
    }
  }

  const onMessageUpdated = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('message_updated', callback)
    }
  }

  const onMessageDeleted = (callback: (data: any) => void) => {
    if (socketRef.value) {
      socketRef.value.on('message_deleted', callback)
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

  const offRoomMissedMessages = (callback?: (data: any[]) => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('room_missed_messages', callback)
        return
      }

      socketRef.value.off('room_missed_messages')
    }
  }

  const offMessageUpdated = (callback?: (data: any) => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('message_updated', callback)
        return
      }

      socketRef.value.off('message_updated')
    }
  }

  const offMessageDeleted = (callback?: (data: any) => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('message_deleted', callback)
        return
      }

      socketRef.value.off('message_deleted')
    }
  }

  const onConnect = (callback: () => void) => {
    if (socketRef.value) {
      socketRef.value.on('connect', callback)
    }
  }

  const offConnect = (callback?: () => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('connect', callback)
        return
      }

      socketRef.value.off('connect')
    }
  }

  // ==================== 私聊功能 ====================

  // 設置用戶ID（連接時調用）
  const setUserId = (userId: number) => {
    emitIfConnected('set_user_id', userId)
  }

  // 加入私聊對話
  const joinPrivateChat = (userId: number, friendId: number) => {
    emitIfConnected('join_private_chat', { userId, friendId })
  }

  const joinPrivateChatWithSeq = (userId: number, friendId: number, lastSeq: number = 0) => {
    emitIfConnected('join_private_chat', { userId, friendId, lastSeq })
  }

  const leavePrivateChat = (friendId: number) => {
    emitIfConnected('leave_private_chat', { friendId })
  }

  // 針對非關鍵即時事件使用（例如輸入中狀態），斷線時不緩衝。
  const emitVolatile = (event: string, payload: any) => {
    return emitIfConnected(event, payload, { volatile: true })
  }

  // 發送私聊消息（ACK）
  const sendPrivateMessage = async (userId: number, friendId: number, content: string) => {
    return emitWithAck<{ success: boolean; message?: string; event?: any }>('send_private_message', { userId, friendId, content })
  }

  // 標記私聊為已讀（ACK）
  const markPrivateAsRead = async (userId: number, friendId: number) => {
    return emitWithAck<{ success: boolean; message?: string }>('mark_private_as_read', { userId, friendId })
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

  const onPrivateMissedMessages = (callback: (data: any[]) => void) => {
    if (socketRef.value) {
      socketRef.value.on('private_missed_messages', callback)
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

  const offPrivateMissedMessages = (callback?: (data: any[]) => void) => {
    if (socketRef.value) {
      if (callback) {
        socketRef.value.off('private_missed_messages', callback)
        return
      }

      socketRef.value.off('private_missed_messages')
    }
  }

  return {
    socket: socketRef,
    isConnected: isConnectedRef,
    initSocket,
    disconnectSocket,
    joinRoom,
    leaveRoom,
    sendMessage,
    updateMessage,
    deleteMessage,
    onReceiveMessage,
    onRoomMissedMessages,
    onMessageUpdated,
    onMessageDeleted,
    onUserJoined,
    onUserLeft,
    offReceiveMessage,
    offRoomMissedMessages,
    offMessageUpdated,
    offMessageDeleted,
    onConnect,
    offConnect,
    setUserId,
    joinPrivateChat,
    joinPrivateChatWithSeq,
    leavePrivateChat,
    emitVolatile,
    sendPrivateMessage,
    markPrivateAsRead,
    onReceivePrivateMessage,
    onPrivateMessageReceived,
    onPrivateMessagesRead,
    onPrivateMissedMessages,
    offReceivePrivateMessage,
    offPrivateMessageReceived,
    offPrivateMessagesRead,
    offPrivateMissedMessages
  }
}
