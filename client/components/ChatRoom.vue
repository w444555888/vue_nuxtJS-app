<template>
  <div class="room-detail">
    <!-- 聊天室頭部 -->
    <div class="chat-header">
      <div class="header-left">
        <h2 class="chat-title">{{ room.name }}</h2>
        <p class="chat-subtitle">{{ room.description }}</p>
      </div>
      <div class="header-right">
        <span class="member-count">👥 {{ room.memberCount }} 人</span>
        <button @click="$emit('invite')" class="btn-icon-small" title="邀請好友">
          +
        </button>
      </div>
    </div>

    <!-- 消息列表區域 -->
    <div class="messages-container">
      <div v-if="messages.length === 0" class="empty-messages">
        <p>暫無消息，開始對話吧！</p>
      </div>
      <div v-else class="messages-list" ref="messagesListRef">
        <div v-for="msg in messages" :key="msg.id" :class="['message-item', { own: msg.userId === currentUserId }]">
          <div class="message-avatar">
            <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.username}`" :alt="msg.username">
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-author">{{ msg.username }}</span>
              <span class="message-time">{{ formatTime(msg.createdAt) }}</span>
            </div>
            <div class="message-text">{{ msg.content }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 輸入框區域 -->
    <div class="chat-input-area">
      <input 
        v-model="inputMessage"
        type="text" 
        placeholder="輸入消息..."
        class="chat-input"
        @keyup.enter="handleSendMessage">
      <button @click="handleSendMessage" class="btn-send">發送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { message } from 'ant-design-vue'
import { useChatService } from '~/composables/useChatService'
import { useSocket } from '~/composables/useSocket'
import { useAuthStore } from '~/stores/auth'

interface Message {
  id: number
  content: string
  userId: number
  username: string
  avatar: string
  createdAt: string
}

interface Room {
  id: number
  name: string
  description?: string
  memberCount: number
}

const props = defineProps<{
  room: Room
  currentUserId: number
}>()

const emit = defineEmits<{
  invite: []
  messageSent: []
}>()

const messages = ref<Message[]>([])
const inputMessage = ref('')
const messagesListRef = ref<HTMLElement | null>(null)
const isLoading = ref(false)

const chatService = useChatService()
const { socket, isConnected, initSocket, joinRoom, sendMessage: socketSendMessage, onReceiveMessage, disconnectSocket } = useSocket()
const authStore = useAuthStore()

// 加載消息
const loadMessages = async () => {
  try {
    isLoading.value = true
    const result = await chatService.fetchMessages(props.room.id)
    if (result.success) {
      messages.value = result.data
      // 自動滾動到最底部
      await nextTick()
      scrollToBottom()
    }
  } catch (error) {
    console.error('加載消息失敗:', error)
  } finally {
    isLoading.value = false
  }
}

// 發送消息（使用 WebSocket）
const handleSendMessage = async () => {
  if (!inputMessage.value.trim()) {
    return
  }

  try {
    // 使用 WebSocket 發送消息
    socketSendMessage(authStore.user?.id, props.room.id, inputMessage.value)
    inputMessage.value = '' // 清空輸入框
    emit('messageSent')
  } catch (error) {
    console.error('❌ 發送消息失敗:', error)
    message.error('發送失敗')
  }
}

// 滾動到底部
const scrollToBottom = () => {
  if (messagesListRef.value) {
    messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight
  }
}

// 格式化時間
const formatTime = (timestamp: string) => {
  const date = new Date(timestamp)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${hours}:${minutes}`
}

// 組件掛載時初始化 Socket
onMounted(async () => {
  // 初始化 Socket 連接
  initSocket()
  
  // 加載歷史消息
  await loadMessages()
  
  // 加入聊天室
  if (authStore.user?.id) {
    joinRoom(authStore.user.id, props.room.id)
  }
  
  // 監聽實時消息
  onReceiveMessage((data: any) => {
    const newMessage: Message = {
      id: data.id || Date.now(),
      content: data.content,
      userId: data.userId,
      username: data.username,
      avatar: data.avatar,
      createdAt: data.createdAt || new Date().toISOString()
    }
    messages.value.push(newMessage)
    nextTick(() => scrollToBottom())
  })
})

// 組件卸載時清理 Socket
onUnmounted(() => {
  // 離開聊天室邏輯（可選，後端暫未實現 leave_room）
  // disconnectSocket()
})

// 監控房間變化，重新加載消息
watch(() => props.room.id, () => {
  loadMessages()
  // 重新加入新房間
  if (authStore.user?.id) {
    joinRoom(authStore.user.id, props.room.id)
  }
}, { immediate: false })
</script>

<style scoped lang="scss">
.room-detail {
  padding: 0;
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: white;
}

/* 聊天室頭部 */
.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  flex: 1;
  min-width: 0;
}

.chat-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-subtitle {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.member-count {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  white-space: nowrap;
}

.btn-icon-small {
  width: 32px;
  height: 32px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-weight: 600;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
}

/* 消息容器 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  background: white;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 3px;

    &:hover {
      background: #999;
    }
  }
}

.empty-messages {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
  text-align: center;
}

/* 消息列表 */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  animation: slideIn 0.3s ease;

  &.own {
    flex-direction: row-reverse;
    align-items: flex-end;
  }

  &.own .message-content {
    align-items: flex-end;
  }

  &.own .message-text {
    background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
    color: white;
  }
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: #f0f0f0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 60%;
  align-items: flex-start;
}

.message-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.message-author {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.message-time {
  font-size: 12px;
  color: #999;
}

.message-text {
  padding: 10px 14px;
  background: #f0f2f5;
  border-radius: 12px;
  word-break: break-word;
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

/* 聊天輸入框區域 */
.chat-input-area {
  padding: 16px 24px;
  border-top: 1px solid #e8e8e8;
  background: white;
  display: flex;
  gap: 12px;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: #fafbfc;
  }

  &::placeholder {
    color: #bbb;
  }
}

.btn-send {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
}
</style>
