export const useChatService = () => {
  const { get, post, patch, delete: deleteRequest } = useHttpClient()
  const chatStore = useChatStore()

  const resolveImageUrl = (imageUrl?: string | null) => {
    if (!imageUrl) return null
    return /^https?:\/\//i.test(imageUrl) ? imageUrl : null
  }

  // ==================== 群組聊天室功能 ====================

  // 獲取聊天室列表
  const fetchRooms = async () => {
    try {
      chatStore.setLoading(true)
      const result = await get('/api/chat/rooms')
      const rooms = result.data || []
      
      // 添加未讀消息數
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

  // 編輯聊天室
  const updateRoom = async (roomId: number, data: { name?: string; description?: string }) => {
    try {
      const result = await patch(`/api/chat/rooms/${roomId}`, data)
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('編輯聊天室失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 邀請好友加入聊天室
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

  // 獲取聊天室消息
  const fetchMessages = async (roomId: number) => {
    try {
      chatStore.setLoading(true)
      const result = await get(`/api/chat/rooms/${roomId}/messages`)
      const messages = result.data || []
      
      // 轉換消息格式
      const formattedMessages = messages.map((msg: any) => ({
        id: msg.id,
        content: msg.content,
        imageUrl: resolveImageUrl(msg.imageUrl),
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
        imageUrl: resolveImageUrl(msg.imageUrl),
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

  // 編輯私聊消息
  const editPrivateMessage = async (friendId: number, messageId: number, content: string) => {
    try {
      const result = await patch(`/api/chat/private/${friendId}/messages/${messageId}`, { content })
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('編輯私聊失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 刪除私聊消息
  const deletePrivateMessage = async (friendId: number, messageId: number) => {
    try {
      const result = await deleteRequest(`/api/chat/private/${friendId}/messages/${messageId}`)
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('刪除私聊失敗:', error)
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

  // 上傳圖片（小文件，單次上傳）
  const uploadImage = async (file: File) => {
    try {
      const formData = new FormData()
      formData.append('image', file)
      
      const result = await post('/api/chat/upload', formData)
      return { success: result.success, data: result.data, message: result.message }
    } catch (error: any) {
      console.error('上傳圖片失敗:', error)
      return { success: false, error: error.message, message: error.message }
    }
  }

  // 分片上傳媒體（使用 simple-uploader.js，支援大文件，帶進度回調）
  const uploadMediaChunked = async (
    file: File,
    onProgress?: (progress: number) => void
  ) => {
    return new Promise((resolve) => {
      try {
        const Uploader = (window as any).Uploader
        if (!Uploader) {
          resolve({ 
            success: false, 
            error: 'Uploader 未初始化', 
            message: 'Uploader 未初始化' 
          })
          return
        }

        const uploadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        const uploader = new Uploader({
          target: '/api/chat/upload-chunk',
          chunkSize: 5 * 1024 * 1024, // 5MB
          simultaneousUploads: 3, // 同時上傳 3 個分片
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          query: () => ({
            uploadId,
            fileName: file.name
          })
        })

        uploader.addFile(file)

        let lastProgressUpdate = 0

        // 監聽上傳進度
        uploader.on('progress', (progress: any) => {
          // simple-uploader.js progress 事件可能返回對象 { loaded, total } 或百分比
          let progressPercent = 0
          
          if (typeof progress === 'number') {
            // 如果是 0-1 的百分比
            progressPercent = Math.round(progress * 90)
          } else if (typeof progress === 'object' && progress.loaded !== undefined) {
            // 如果是 { loaded, total } 的對象
            progressPercent = Math.round((progress.loaded / progress.total) * 90)
          }
          
          // 防止頻繁更新，每次更新至少間隔 1%
          if (onProgress && Math.abs(progressPercent - lastProgressUpdate) >= 1) {
            onProgress(progressPercent)
            lastProgressUpdate = progressPercent
            console.log(`上傳進度: ${progressPercent}%`, progress) // 調試用
          }
        })

        // 監聽所有分片上傳完成
        uploader.on('complete', async () => {
          try {
            if (onProgress) {
              onProgress(95) // 合併中
            }

            const mergeFormData = new FormData()
            mergeFormData.append('uploadId', uploadId)
            mergeFormData.append('totalChunks', uploader.fileList[0]?.chunks?.length.toString() || '1')
            mergeFormData.append('fileName', file.name)

            const mergeResult = await post('/api/chat/upload-merge', mergeFormData)

            if (!mergeResult.success) {
              resolve({
                success: false,
                error: mergeResult.message || '媒體合併失敗',
                message: mergeResult.message || '媒體合併失敗'
              })
              return
            }

            if (onProgress) {
              onProgress(100)
            }

            resolve({
              success: true,
              data: { mediaUrl: mergeResult.data.mediaUrl },
              message: '媒體上傳成功'
            })
          } catch (error: any) {
            console.error('合併失敗:', error)
            resolve({
              success: false,
              error: error.message,
              message: error.message
            })
          }
        })

        // 監聽上傳錯誤
        uploader.on('error', (err: any) => {
          console.error('上傳錯誤:', err)
          resolve({
            success: false,
            error: err.message || '上傳失敗',
            message: err.message || '上傳失敗'
          })
        })

        // 開始上傳
        uploader.upload()
      } catch (error: any) {
        console.error('分片上傳初始化失敗:', error)
        resolve({
          success: false,
          error: error.message,
          message: error.message
        })
      }
    })
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
    editPrivateMessage,
    deletePrivateMessage,
    markPrivateAsRead,
    uploadImage,
    uploadMediaChunked
  }
}
