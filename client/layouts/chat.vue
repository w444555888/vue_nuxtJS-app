<template>
  <div class="chat-layout">
    <ChatSidebar />
    <div class="chat-main">
      <ChatHeader />
      <ChatMessageList />
      <ChatInputBox />
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()
const chatStore = useChatStore()
const { initSocket, onReceiveMessage, joinRoom } = useSocket()
const { fetchRooms, fetchMessages } = useChatService()

// 页面卸载时清理
onBeforeUnmount(() => {
  // 可選：斷開 Socket 連接
})

// 監听訊息
const handleReceiveMessage = (data: any) => {
  chatStore.addMessage({
    id: data.id,
    content: data.content,
    userId: data.userId,
    username: data.userId,
    avatar: data.avatar,
    roomId: data.roomId,
    timestamp: data.timestamp,
    createdAt: data.timestamp
  })
}

// 初始化
onMounted(async () => {
  // 初始化 Socket 連接
  initSocket()
  onReceiveMessage(handleReceiveMessage)
  
  // 加載聊天室列表
  const result = await fetchRooms()
  if (!result.success) {
    message.error('加載聊天室失敗')
  }
})
</script>

<style scoped lang="css">
.chat-layout {
  display: flex;
  height: 100vh;
  background: #fff;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
