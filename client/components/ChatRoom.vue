<template>
  <div class="room-detail">
    <!-- 聊天室頭部 -->
    <div class="chat-header">
      <div class="header-left">
        <h2 class="chat-title">{{ room.name }}</h2>
        <p class="chat-subtitle">{{ room.description }}</p>
      </div>
      <div class="header-right">
        <span class="member-count" @click="showMembersModal = true" title="點擊查看成員">
          <div class="members-avatars">
            <img 
              v-for="member in (room.members?.slice(0, 5) || [])" 
              :key="member.id"
              :src="member.avatar || `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${member.username}`"
              :alt="member.username"
              class="member-avatar-small"
              :title="member.username"
            />
            <span v-if="(room.members?.length || 0) > 5" class="members-more">...</span>
          </div>
          {{ room.memberCount }} 人
        </span>
        <button @click="emit('invite')" class="btn-icon-small" title="邀請好友">
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
          @contextmenu.prevent="(event) => showContextMenu(event, msg)"
        >
          <div class="message-avatar">
            <img :src="msg.avatar || `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${msg.username}`" :alt="msg.username" />
          </div>
          <div class="message-content">
            <div class="message-header">
              <span class="message-author">{{ msg.username }}</span>
              <span class="message-time">{{ formatTime(msg.createdAt) }}</span>
            </div>
            <div class="message-text">
              <video
                v-if="msg.imageUrl && isVideoUrl(msg.imageUrl)"
                :src="toImageSrc(msg.imageUrl)"
                class="message-media"
                controls
                preload="metadata"
              />
              <img v-else-if="msg.imageUrl" :src="toImageSrc(msg.imageUrl)" :alt="msg.content" class="message-media" />
              <div v-if="msg.content" class="message-text-content">{{ msg.content }}</div>
            </div>
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
    <Modal 
      :show="showEditModal" 
      title="編輯消息"
      @update:show="(value) => showEditModal = value"
    >
      <textarea 
        v-model="editingContent"
        placeholder="輸入新的消息內容..."
        class="edit-textarea"
      ></textarea>
      <template #actions>
        <button @click="submitEdit" class="btn-primary">保存</button>
        <button @click="showEditModal = false" class="btn-secondary">取消</button>
      </template>
    </Modal>

    <!-- 成員列表模態框 -->
    <Modal 
      :show="showMembersModal" 
      :title="`群組成員 (${room.members?.length || 0})`"
      @update:show="(value) => showMembersModal = value"
    >
      <div v-if="!room.members || room.members.length === 0" class="empty-state">
        暫無成員
      </div>
      <div v-else class="members-list">
        <div v-for="member in room.members" :key="member.id" :class="['member-item', { 'is-creator': member.id === room.creatorId }]">
          <img 
            :src="member.avatar || `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${member.username}`" 
            :alt="member.username"
            class="member-avatar"
          />
          <div class="member-info">
            <span class="member-name">{{ member.username }}</span>
            <div v-if="member.id === room.creatorId" class="creator-badge">
              <CrownOutlined />
              <span>房主</span>
            </div>
          </div>
        </div>
      </div>
      <template #actions>
        <button @click="showMembersModal = false" class="btn-secondary">關閉</button>
      </template>
    </Modal>

    <!-- 輸入框區域 -->
    <div class="chat-input-area">
      <div class="input-controls">
        <input 
          ref="fileInputRef"
          type="file" 
          accept="image/*,video/*"
          style="display: none"
          @change="handleImageSelect"
        />
        <button @click="fileInputRef?.click()" class="btn-icon-input" title="上傳圖片或影片">
          <PictureOutlined />
        </button>
      </div>
      <input 
        v-model="inputMessage"
        type="text" 
        placeholder="輸入消息..."
        class="chat-input"
        @keyup.enter="handleSendMessage" />
      <button @click="handleSendMessage" class="btn-send" :disabled="isUploading">
        {{ isUploading ? '上傳中...' : '發送' }}
      </button>
    </div>

    <!-- 媒體預覽 -->
    <div v-if="previewMedia" class="image-preview">
      <div class="preview-content">
        <video v-if="previewType === 'video'" :src="previewMedia" controls preload="metadata" />
        <img v-else :src="previewMedia" :alt="previewMedia" />
        <button @click="clearImagePreview" class="btn-clear-preview">✕</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted, onUpdated } from 'vue'
import { message } from 'ant-design-vue'
import { TeamOutlined, CrownOutlined, PictureOutlined } from '@antdv-next/icons'
import dayjs from 'dayjs'
import Modal from '~/components/Modal.vue'
import ConfirmModal from '~/components/ConfirmModal.vue'
import { useChatService } from '~/composables/useChatService'
import { useSocket } from '~/composables/useSocket'
import { useAuthStore } from '~/stores/auth'

interface Message {
  id: number
  seq?: number
  roomId?: number
  content: string
  imageUrl?: string
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
  creatorId?: number
  creator?: {
    id: number
    username: string
    avatar?: string
  }
  members?: Array<{
    id: number
    username: string
    avatar?: string
  }>
}

const props = defineProps<{
  room: Room
  currentUserId: number
}>()

const toImageSrc = (imageUrl?: string) => {
  if (!imageUrl) return ''
  return /^https?:\/\//i.test(imageUrl) ? imageUrl : ''
}

const isVideoUrl = (url?: string) => {
  if (!url) return false
  return /(\.mp4|\.webm|\.mov)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url)
}

const emit = defineEmits<{
  invite: []
  messageSent: []
}>()

const messages = ref<Message[]>([])
const inputMessage = ref('')
const messagesListRef = ref<HTMLElement | null>(null)
const fileInputRef = ref<HTMLInputElement | null>(null)
const isLoading = ref(false)
const isUploading = ref(false)
const showEditModal = ref(false)
const editingContent = ref('')
const editingMessage = ref<Message | null>(null)
const showMembersModal = ref(false)
const previewMedia = ref<string | null>(null)
const previewType = ref<'image' | 'video' | null>(null)
const selectedFile = ref<File | null>(null)
const contextMenu = ref({
  show: false,
  x: 0,
  y: 0,
  message: null as Message | null
})

const chatService = useChatService()
const {
  initSocket,
  joinRoom,
  leaveRoom,
  sendMessage: socketSendMessage,
  updateMessage: socketUpdateMessage,
  deleteMessage: socketDeleteMessage,
  onReceiveMessage,
  onRoomMissedMessages,
  onMessageUpdated,
  onMessageDeleted,
  onConnect,
  offReceiveMessage,
  offRoomMissedMessages,
  offMessageUpdated,
  offMessageDeleted,
  offConnect
} = useSocket()
const authStore = useAuthStore()
let roomMessageListener: ((data: any) => void) | null = null
let roomMissedMessagesListener: ((data: any[]) => void) | null = null
let messageUpdatedListener: ((data: any) => void) | null = null
let messageDeletedListener: ((data: any) => void) | null = null
let connectListener: (() => void) | null = null
const joinedRoomId = ref<number | null>(null)
const messageIdSet = ref<Set<number>>(new Set())

const getLastSeq = () => {
  return messages.value.reduce((maxSeq, item) => {
    const seqValue = Number(item.seq ?? item.id ?? 0)
    return seqValue > maxSeq ? seqValue : maxSeq
  }, 0)
}

const applyCreatedMessage = (data: any) => {
  if (data?.roomId !== props.room.id) {
    return
  }

  const messageId = Number(data?.id)
  if (!Number.isInteger(messageId)) {
    return
  }

  if (messageIdSet.value.has(messageId)) {
    return
  }

  const newMessage: Message = {
    id: messageId,
    seq: Number(data?.seq || messageId),
    roomId: Number(data?.roomId || props.room.id),
    content: data.content,
    imageUrl: data.imageUrl,
    userId: data.userId,
    username: data.username,
    avatar: data.avatar,
    createdAt: data.createdAt || new Date().toISOString()
  }

  messageIdSet.value.add(messageId)
  messages.value.push(newMessage)
  nextTick(() => scrollToBottom())
}

const applyUpdatedMessage = (data: any) => {
  if (data?.roomId !== props.room.id) {
    return
  }

  const target = messages.value.find((item) => item.id === data.id)
  if (!target) {
    return
  }

  target.content = data.content
  if (data.seq) {
    target.seq = data.seq
  }
}

const applyDeletedMessage = (data: any) => {
  if (data?.roomId !== props.room.id) {
    return
  }

  const messageId = Number(data?.id)
  messages.value = messages.value.filter((item) => item.id !== messageId)
  messageIdSet.value.delete(messageId)
}

const joinRoomWithRecovery = () => {
  if (!authStore.user?.id) {
    return
  }

  joinRoom(authStore.user.id, props.room.id, getLastSeq())
  joinedRoomId.value = props.room.id
}

// 加載消息
const loadMessages = async () => {
  try {
    isLoading.value = true
    const result = await chatService.fetchMessages(props.room.id)
    if (result.success) {
      const sortedMessages = [...(result.data || [])].sort((a: any, b: any) => (a.id || 0) - (b.id || 0))
      messages.value = sortedMessages.map((item: any) => ({
        ...item,
        seq: item.id,
        roomId: item.roomId || props.room.id
      }))
      messageIdSet.value = new Set(messages.value.map((item) => item.id))
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

// 處理媒體選擇
const handleImageSelect = async (event: Event) => {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return

  const isImage = file.type.startsWith('image/')
  const isVideo = file.type.startsWith('video/')

  // 檢查文件類型
  if (!isImage && !isVideo) {
    message.error('請選擇圖片或影片文件')
    return
  }

  const maxSize = isVideo ? 50 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > maxSize) {
    message.error(isVideo ? '影片大小不能超過 50MB' : '圖片大小不能超過 10MB')
    return
  }

  if (previewMedia.value && previewMedia.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewMedia.value)
  }

  selectedFile.value = file
  previewType.value = isVideo ? 'video' : 'image'
  previewMedia.value = URL.createObjectURL(file)
}

// 清除媒體預覽
const clearImagePreview = () => {
  if (previewMedia.value && previewMedia.value.startsWith('blob:')) {
    URL.revokeObjectURL(previewMedia.value)
  }
  previewMedia.value = null
  previewType.value = null
  selectedFile.value = null
  if (fileInputRef.value) {
    fileInputRef.value.value = ''
  }
}

// 發送消息（使用 WebSocket）
const handleSendMessage = async () => {
  if (!inputMessage.value.trim() && !selectedFile.value) {
    message.error('請輸入消息或選擇圖片/影片')
    return
  }

  if (!authStore.user?.id) {
    message.error('尚未登入，無法發送消息')
    return
  }

  try {
    let imageUrl: string | undefined = undefined

    // 如果有選擇的媒體文件，先上傳
    if (selectedFile.value) {
      isUploading.value = true
      const uploadResult = await chatService.uploadImage(selectedFile.value)
      if (!uploadResult.success) {
        message.error(uploadResult.message || '媒體上傳失敗')
        return
      }
      imageUrl = uploadResult.data?.imageUrl
      isUploading.value = false
    }

    // 使用 WebSocket 發送消息
    const result = await socketSendMessage(
      authStore.user.id, 
      props.room.id, 
      inputMessage.value,
      imageUrl
    )
    if (!result?.success) {
      message.error(result?.message || '發送失敗')
      return
    }

    inputMessage.value = '' // 清空輸入框
    clearImagePreview() // 清空媒體預覽
    emit('messageSent')
  } catch (error) {
    console.error('發送消息失敗:', error)
    message.error('發送失敗')
  } finally {
    isUploading.value = false
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
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
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
    const result = await socketUpdateMessage(
      props.room.id,
      editingMessage.value.id,
      editingContent.value
    )
    
    if (result.success) {
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
    const result = await socketDeleteMessage(
      props.room.id,
      contextMenu.value.message.id
    )
    
    if (result.success) {
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

  roomMessageListener = (data: any) => {
    applyCreatedMessage(data)
  }

  roomMissedMessagesListener = (events: any[]) => {
    if (!Array.isArray(events)) {
      return
    }

    events.forEach((item) => applyCreatedMessage(item))
  }

  messageUpdatedListener = (data: any) => {
    applyUpdatedMessage(data)
  }

  messageDeletedListener = (data: any) => {
    applyDeletedMessage(data)
  }

  connectListener = () => {
    joinRoomWithRecovery()
  }

  onReceiveMessage(roomMessageListener)
  onRoomMissedMessages(roomMissedMessagesListener)
  onMessageUpdated(messageUpdatedListener)
  onMessageDeleted(messageDeletedListener)
  onConnect(connectListener)
  
  // 加載歷史消息
  await loadMessages()
  
  // 加入聊天室
  joinRoomWithRecovery()
})

// 每次更新後自動滾動到底部
onUpdated(() => {
  scrollToBottom()
})

// 組件卸載時清理 Socket
onUnmounted(() => {
  if (joinedRoomId.value) {
    leaveRoom(joinedRoomId.value)
  }

  if (roomMessageListener) {
    offReceiveMessage(roomMessageListener)
    roomMessageListener = null
  }

  if (roomMissedMessagesListener) {
    offRoomMissedMessages(roomMissedMessagesListener)
    roomMissedMessagesListener = null
  }

  if (messageUpdatedListener) {
    offMessageUpdated(messageUpdatedListener)
    messageUpdatedListener = null
  }

  if (messageDeletedListener) {
    offMessageDeleted(messageDeletedListener)
    messageDeletedListener = null
  }

  if (connectListener) {
    offConnect(connectListener)
    connectListener = null
  }
})

// 監控房間變化，重新加載消息
watch(() => props.room.id, async (newRoomId, oldRoomId) => {
  if (oldRoomId) {
    leaveRoom(oldRoomId)
  }

  joinedRoomId.value = null
  messageIdSet.value = new Set()
  messages.value = []
  await loadMessages()
  joinRoomWithRecovery()
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
  gap: 8px;
  cursor: pointer;
  transition: all 0.2s;
  padding: 6px 10px;
  border-radius: 6px;
}

.members-avatars {
  display: flex;
  align-items: center;
  gap: 4px;
}

.member-avatar-small {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  border: 2px solid #e8e8e8;
  transition: all 0.2s;
}

.members-more {
  font-size: 12px;
  font-weight: 600;
  color: #999;
  margin-left: 2px;
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

/* 成員列表 */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 60vh;
  overflow-y: auto;
}

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 8px;
  transition: all 0.2s;
  background: #fafbfc;

  &:hover {
    background: #f0f2f5;
  }

  &.is-creator {
    background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(168, 148, 199, 0.1) 100%);
    border: 1px solid rgba(102, 126, 234, 0.2);
  }
}

.member-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
  border: 2px solid #e8e8e8;
  transition: all 0.2s;
}

.member-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  flex: 1;
  min-width: 0;
}

.member-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.creator-badge {
  font-size: 12px;
  color: #667eea;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  width: fit-content;
}

.creator-badge :deep(svg) {
  width: 14px;
  height: 14px;
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

/* 編輯消息 */
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

/* 成員列表 */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;

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

.member-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 14px;
  background: #f9fafb;
  border: 1px solid #e8e8e8;
  border-radius: 8px;
  transition: all 0.2s;

  &:hover {
    background: #f0f2f5;
    border-color: #d9d9d9;
  }
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  object-fit: cover;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

/* 媒體相關樣式 */
.message-media {
  max-width: 300px;
  max-height: 300px;
  border-radius: 8px;
  margin-bottom: 4px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
}

.message-text-content {
  word-break: break-word;
}

.input-controls {
  display: flex;
  align-items: center;
}

.btn-icon-input {
  width: 40px;
  height: 40px;
  border: 1px solid #d9d9d9;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    border-color: #667eea;
    background: #f9fafb;
    color: #667eea;
  }

  &:active {
    transform: scale(0.95);
  }
}

.image-preview {
  padding: 12px 24px 0 24px;
  background: white;
  border-top: 1px solid #e8e8e8;
  display: flex;
  gap: 8px;
}

.preview-content {
  position: relative;
  display: inline-block;

  img,
  video {
    max-width: 100px;
    max-height: 100px;
    border-radius: 8px;
    border: 1px solid #d9d9d9;
  }

  .btn-clear-preview {
    position: absolute;
    top: -8px;
    right: -8px;
    width: 24px;
    height: 24px;
    border: none;
    background: #ff4d4f;
    color: white;
    border-radius: 50%;
    font-size: 12px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s;

    &:hover {
      background: #ff7875;
      transform: scale(1.1);
    }
  }
}

.btn-send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

</style>
