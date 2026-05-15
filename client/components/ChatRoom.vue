<template>
  <div class="room-detail">
    <!-- 聊天室頭部 -->
    <div class="chat-header">
      <div class="header-left">
        <h2 class="chat-title">{{ room.name }}</h2>
        <p class="chat-subtitle">{{ room.description }}</p>
      </div>
      <div class="header-right">
        <span class="member-count"><TeamOutlined /> {{ room.memberCount }} 人</span>
        <button @click="$emit('invite')" class="btn-icon-small" title="邀請好友">
          +
        </button>
      </div>
    </div>

    <!-- 消息列表區域 -->
    <div class="messages-container" ref="messagesListRef">
      <div v-if="messages.length === 0" class="empty-messages">
        <p>暫無消息，開始對話吧！</p>
      </div>
      <div v-else class="messages-list">
        <div 
          v-for="msg in messages" 
          :key="msg.id" 
          :class="['message-item', { own: msg.userId === props.currentUserId }]"
          @contextmenu.prevent="showContextMenu($event, msg)"
        >
          <div class="message-avatar">
            <img :src="`https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.username}`" :alt="msg.username" />
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

    <!-- 右鍵菜單 -->
    <div v-if="contextMenu.show" class="context-menu" :style="{ top: contextMenu.y + 'px', left: contextMenu.x + 'px' }">
      <div class="context-item" @click="openEditModal">編輯</div>
      <div class="context-item danger" @click="deleteMessage">刪除</div>
    </div>

    <!-- 編輯消息模態框 -->
    <div v-if="showEditModal" class="modal-overlay" @click.self="showEditModal = false">
      <div class="modal-content">
        <h2>編輯消息</h2>
        <div class="modal-form">
          <textarea 
            v-model="editingContent"
            placeholder="輸入新的消息內容..."
            class="edit-textarea"
          ></textarea>
        </div>
        <div class="modal-actions">
          <button @click="submitEdit" class="btn-primary">保存</button>
          <button @click="showEditModal = false" class="btn-secondary">取消</button>
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
        @keyup.enter="handleSendMessage" />
      <button @click="handleSendMessage" class="btn-send">發送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, onUpdated } from 'vue'
import { message } from 'ant-design-vue'
import { TeamOutlined } from '@antdv-next/icons'
import dayjs from 'dayjs'
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
const showEditModal = ref(false)
const editingContent = ref('')
const editingMessage = ref<Message | null>(null)
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  message: null as Message | null
})

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
    console.error('發送消息失敗:', error)
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
  return dayjs(timestamp).format('HH:mm')
}

// 顯示右鍵菜單
const showContextMenu = (event: MouseEvent, msg: Message) => {
  if (msg.userId !== props.currentUserId) return // 只能編輯自己的消息
  
  contextMenu.value = {
    show: true,
    x: event.clientX,
    y: event.clientY,
    message: msg
  }
  
  // 點擊其他地方時隱藏菜單
  setTimeout(() => {
    document.addEventListener('click', hideContextMenu)
  }, 0)
}

// 隱藏右鍵菜單
const hideContextMenu = () => {
  contextMenu.value.show = false
  document.removeEventListener('click', hideContextMenu)
}

// 打開編輯模態框
const openEditModal = () => {
  if (!contextMenu.value.message) return
  editingMessage.value = contextMenu.value.message
  editingContent.value = contextMenu.value.message.content
  showEditModal.value = true
  hideContextMenu()
}

// 提交編輯
const submitEdit = async () => {
  if (!editingMessage.value || !editingContent.value.trim()) {
    message.error('消息內容不能為空')
    return
  }

  try {
    const result = await chatService.editMessage(
      props.room.id,
      editingMessage.value.id,
      editingContent.value
    )
    
    if (result.success) {
      // 更新本地消息
      const targetMessage = messages.value.find(m => m.id === editingMessage.value?.id)
      if (targetMessage) {
        targetMessage.content = editingContent.value
      }
      
      message.success('消息已更新')
      showEditModal.value = false
      editingMessage.value = null
      editingContent.value = ''
    } else {
      message.error(result.message || '編輯失敗')
    }
  } catch (error) {
    console.error('編輯消息失敗:', error)
    message.error('編輯失敗')
  }
}

// 刪除消息
const deleteMessage = async () => {
  if (!contextMenu.value.message) return
  
  try {
    const result = await chatService.deleteMessage(
      props.room.id,
      contextMenu.value.message.id
    )
    
    if (result.success) {
      // 從本地消息中刪除
      messages.value = messages.value.filter(m => m.id !== contextMenu.value.message?.id)
      message.success('消息已收回')
    } else {
      message.error(result.message || '收回消息失敗')
    }
  } catch (error) {
    console.error('收回消息失敗:', error)
    message.error('收回消息失敗')
  } finally {
    hideContextMenu()
  }
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

// 每次更新後自動滾動到底部
onUpdated(() => {
  scrollToBottom()
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
  font-size: 14px;
  color: #000000;
  font-weight: 500;
  white-space: nowrap;
  display: flex;
  align-items: center;
  gap: 6px;
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

/* 右鍵菜單 */
.context-menu {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 120px;
  overflow: hidden;
}

.context-item {
  padding: 10px 16px;
  cursor: pointer;
  transition: all 0.2s;
  font-size: 14px;
  color: #333;
  
  &:hover {
    background: #f5f5f5;
    color: #667eea;
  }
  
  &.danger {
    color: #ff4d4f;
    
    &:hover {
      background: #fff1f0;
    }
  }
}

/* 編輯模態框 */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  max-width: 500px;
  width: 90%;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
  animation: slideUp 0.3s ease;

  h2 {
    margin: 0 0 16px 0;
    font-size: 18px;
    color: #333;
    font-weight: 600;
  }
}

.modal-form {
  margin-bottom: 20px;
}

.edit-textarea {
  width: 100%;
  padding: 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-family: inherit;
  font-size: 14px;
  line-height: 1.5;
  resize: vertical;
  min-height: 100px;
  transition: all 0.2s;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
    background: #fafbfc;
  }
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}

.btn-primary,
.btn-secondary {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  color: white;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
}

.btn-secondary {
  background: #f0f0f0;
  color: #666;

  &:hover {
    background: #e8e8e8;
  }
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}


</style>
