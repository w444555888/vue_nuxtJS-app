<template>
  <div class="private-chat-container">
    <!-- 私聊頭部 -->
    <div class="chat-header">
      <div class="header-left">
        <img 
          :src="friend.avatar || `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${friend.username}`"
          class="header-avatar"
          alt="avatar"
        >
        <div>
          <h2 class="chat-title">{{ friend.username }}</h2>
          <p class="chat-subtitle">{{ friend.email }}</p>
        </div>
      </div>
      <div class="header-right">
        <button @click="closeChat" class="btn-icon-small">✕</button>
      </div>
    </div>

    <!-- 私聊消息區 -->
    <div ref="messagesListRef" class="messages-container">
      <div v-if="messages.length === 0" class="empty-messages">
        暫無消息，開始對話吧
      </div>
      <div v-else class="messages-list">
        <div 
          v-for="msg in messages" 
          :key="msg.id" 
          :class="['message-item', { own: msg.senderId === currentUserId }]"
          @contextmenu.prevent="(event) => showContextMenu(event, msg)"
        >
          <img 
            :src="msg.senderAvatar || `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${msg.senderName}`" 
            class="message-avatar"
            alt="avatar"
          >
          <div class="message-content">
            <div class="message-header">
              <span class="message-author">{{ msg.senderName }}</span>
              <span class="message-time">{{ formatTime(msg.createdAt) }}</span>
            </div>
            <div class="message-text">
              <div v-if="msg.replyPreview" class="reply-preview">
                <span class="reply-author">回覆 {{ msg.replyPreview.senderName }}</span>
                <img
                  v-if="msg.replyPreview.imageUrl"
                  :src="toImageSrc(msg.replyPreview.imageUrl)"
                  alt="reply image"
                  class="reply-media-thumb"
                >
                <span v-if="msg.replyPreview.content" class="reply-content">{{ truncateReplyContent(msg.replyPreview.content) }}</span>
              </div>
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
      <div class="context-item" @click="startReply">回覆</div>
      <div v-if="contextMenu.message?.senderId === props.currentUserId" class="context-item" @click="openEditModal">編輯</div>
      <div v-if="contextMenu.message?.senderId === props.currentUserId" class="context-item danger" @click="removePrivateMessage">刪除</div>
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

    <div v-if="replyTarget" class="reply-target-bar">
      <div class="reply-target-text">
        回覆 {{ replyTarget.senderName }}：{{ truncateReplyContent(replyTarget.content) }}
      </div>
      <img
        v-if="replyTarget.imageUrl"
        :src="toImageSrc(replyTarget.imageUrl)"
        alt="reply target image"
        class="reply-target-thumb"
      >
      <button type="button" class="reply-cancel-btn" @click="cancelReply">取消</button>
    </div>

    <!-- 私聊輸入框 -->
    <div class="chat-input-area">
      <div class="input-controls">
        <input
          ref="mediaInputRef"
          type="file"
          accept="image/*,video/*"
          class="file-input-hidden"
          @change="onMediaInputChange"
        />
        <button type="button" class="btn-icon-input" title="上傳圖片或影片" @click="openMediaPicker">
          <PictureOutlined />
        </button>
      </div>
      <input 
        v-model="messageContent"
        type="text" 
        placeholder="輸入消息..." 
        class="chat-input"
        @keyup.enter.exact.prevent="sendMessage"
      >
      <button @click="sendMessage" class="btn-send" :disabled="isUploading || isSending">
        {{ isUploading ? '上傳中...' : isSending ? '發送中...' : '發送' }}
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

    <!-- 上傳進度條 -->
    <div v-if="isUploading && uploadProgress >= 0" class="upload-progress-bar">
      <div class="progress-wrapper">
        <div class="progress-info">
          <span class="progress-text">上傳中...</span>
          <span class="progress-percent">{{ uploadProgress }}%</span>
        </div>
        <div class="progress-container">
          <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { message } from 'ant-design-vue'
import { PictureOutlined } from '@antdv-next/icons'
import Modal from '~/components/Modal.vue'
import { useChatCache } from '~/composables/useChatCache'
import { useChatMediaInput } from '~/composables/useChatMediaInput'
import { useMessageContextMenu } from '~/composables/useMessageContextMenu'
import { CHAT_UPLOAD_LIMITS, useChatService } from '~/composables/useChatService'
import { useSocket } from '~/composables/useSocket'
import { useChatStore } from '~/stores/chat'
import {
  formatMessageTime as formatTime,
  isVideoUrl,
  toImageSrc,
  truncateReplyContent
} from '~/utils/chatMessageDisplay'
import { getLastMessageSeq, normalizeMessageSnapshot } from '~/utils/chatMessageSync'

interface Friend {
  id: number
  username: string
  email: string
  avatar?: string
}

interface Message {
  id: number
  seq?: number
  content: string
  imageUrl?: string
  replyToMessageId?: number | null
  replyPreview?: {
    id: number
    content: string
    imageUrl?: string | null
    senderId?: number
    senderName: string
  } | null
  senderId: number
  senderName: string
  senderAvatar?: string
  receiverId: number
  isRead: boolean
  createdAt: string
}

const props = defineProps<{
  friend: Friend
  currentUserId: number
}>()

const emit = defineEmits<{
  close: []
  messageSent: []
}>()

const chatService = useChatService()
const chatCache = useChatCache()
const socket = useSocket()
const chatStore = useChatStore()

const messages = computed<Message[]>(() => {
  return chatStore.getPrivateMessages<Message>(props.currentUserId, props.friend.id)
})
const messageContent = ref('')
const messagesListRef = ref<HTMLElement | null>(null)
const showEditModal = ref(false)
const editingContent = ref('')
const editingMessage = ref<Message | null>(null)
const isUploading = ref(false)
const isSending = ref(false)
const lastSendAt = ref(0)
const SEND_THROTTLE_MS = 500
const uploadProgress = ref(0)
const mediaInputRef = ref<HTMLInputElement | null>(null)
const {
  replyTarget,
  contextMenu,
  showContextMenu,
  hideContextMenu,
  startReply,
  cancelReply
} = useMessageContextMenu<Message>()

const {
  previewMedia,
  previewType,
  selectedFile,
  openMediaPicker,
  onMediaInputChange,
  clearImagePreview
} = useChatMediaInput({
  mediaInputRef,
  maxImageBytes: CHAT_UPLOAD_LIMITS.MAX_IMAGE_BYTES,
  maxVideoBytes: CHAT_UPLOAD_LIMITS.MAX_VIDEO_BYTES,
  onError: (errorMessage) => message.error(errorMessage)
})

let messageListener: ((data: any) => void) | null = null
let privateMissedMessagesListener: ((data: any[]) => void) | null = null
let privateMessageUpdatedListener: ((data: any) => void) | null = null
let privateMessageDeletedListener: ((data: any) => void) | null = null
let connectListener: ((recovered: boolean) => void) | null = null
let privateSyncPromise: Promise<void> | null = null

const applyPrivateMessage = (data: any) => {
  if (
    !(
      (data.senderId === props.friend.id && data.receiverId === props.currentUserId) ||
      (data.senderId === props.currentUserId && data.receiverId === props.friend.id)
    )
  ) {
    return
  }

  const messageId = Number(data?.id)
  if (!Number.isInteger(messageId)) {
    return
  }

  if (chatStore.hasPrivateMessage(props.currentUserId, props.friend.id, messageId)) {
    return
  }

  const newMessage: Message = {
    id: messageId,
    seq: Number(data?.seq || messageId),
    content: data.content,
    imageUrl: data.imageUrl,
    replyToMessageId: data.replyToMessageId || null,
    replyPreview: data.replyPreview || null,
    senderId: data.senderId,
    senderName: data.senderName,
    senderAvatar: data.senderAvatar,
    receiverId: data.receiverId,
    isRead: data.isRead,
    createdAt: data.createdAt
  }

  chatStore.addPrivateMessage(props.currentUserId, props.friend.id, newMessage)
  void chatCache.putPrivateMessage(props.currentUserId, props.friend.id, newMessage)
  nextTick(() => scrollToBottom())
}

const isCurrentConversationEvent = (data: any) => {
  return (
    (data?.senderId === props.friend.id && data?.receiverId === props.currentUserId) ||
    (data?.senderId === props.currentUserId && data?.receiverId === props.friend.id)
  )
}

const applyUpdatedPrivateMessage = (data: any) => {
  if (!isCurrentConversationEvent(data)) {
    return
  }

  const patch: Record<string, any> = {
    content: data.content
  }

  if (data.seq) {
    patch.seq = data.seq
  }

  const updated = chatStore.updatePrivateMessage(
    props.currentUserId,
    props.friend.id,
    data.id,
    patch
  )
  if (!updated) {
    return
  }

  void chatCache.updatePrivateMessage(props.currentUserId, props.friend.id, data.id, {
    content: data.content,
    seq: data.seq
  })
}

const applyDeletedPrivateMessage = (data: any) => {
  if (!isCurrentConversationEvent(data)) {
    return
  }

  const messageId = Number(data?.id)
  if (!Number.isInteger(messageId)) {
    return
  }

  const removed = chatStore.removePrivateMessage(props.currentUserId, props.friend.id, messageId)
  if (!removed) {
    return
  }

  void chatCache.deletePrivateMessage(props.currentUserId, props.friend.id, messageId)

  if (replyTarget.value?.id === messageId) {
    replyTarget.value = null
  }
}

// 加入 WS 私聊會話，並告知後端目前游標以補回之後遺漏的新增訊息。
const joinPrivateChatAndReplayMissedMessages = () => {
  // Snapshot + WS：私聊先補差異，再回到即時推送。
  socket.joinPrivateChatWithSeq(
    props.currentUserId,
    props.friend.id,
    getLastMessageSeq(messages.value)
  )
}

// 以後端 HTTP 快照校正本機私聊資料後，再補快照與加入 WS 之間的新增訊息。
const syncPrivateSnapshotAndJoin = () => {
  if (privateSyncPromise) {
    return privateSyncPromise
  }

  privateSyncPromise = (async () => {
    try {
      await loadMessages()
      joinPrivateChatAndReplayMissedMessages()
    } finally {
      privateSyncPromise = null
    }
  })()

  return privateSyncPromise
}

const openEditModal = () => {
  if (!contextMenu.value.message) return
  if (contextMenu.value.message.senderId !== props.currentUserId) {
    hideContextMenu()
    return
  }
  editingMessage.value = contextMenu.value.message
  editingContent.value = contextMenu.value.message.content
  showEditModal.value = true
  hideContextMenu()
}

const closeChat = () => {
  hideContextMenu()

  if (messageListener) {
    socket.offReceivePrivateMessage(messageListener)
    messageListener = null
  }

  if (privateMessageUpdatedListener) {
    socket.offPrivateMessageUpdated(privateMessageUpdatedListener)
    privateMessageUpdatedListener = null
  }

  if (privateMessageDeletedListener) {
    socket.offPrivateMessageDeleted(privateMessageDeletedListener)
    privateMessageDeletedListener = null
  }

  if (privateMissedMessagesListener) {
    socket.offPrivateMissedMessages(privateMissedMessagesListener)
    privateMissedMessagesListener = null
  }

  if (connectListener) {
    socket.offConnect(connectListener)
    connectListener = null
  }

  socket.leavePrivateChat(props.friend.id)
  emit('close')
}

const sendMessage = async () => {
  if (isSending.value || isUploading.value) {
    return
  }

  const now = Date.now()
  if (now - lastSendAt.value < SEND_THROTTLE_MS) {
    return
  }

  const content = messageContent.value.trim()

  if (!content && !selectedFile.value) {
    message.error('請輸入消息或選擇圖片/影片')
    return
  }

  try {
    lastSendAt.value = now
    isSending.value = true
    let imageUrl: string | undefined = undefined

    // 如果有選擇的媒體文件，先上傳
    if (selectedFile.value) {
      isUploading.value = true
      uploadProgress.value = 0
      const uploadResult = await chatService.uploadMedia(selectedFile.value, (progress) => {
        uploadProgress.value = progress
      })
      
      if (!uploadResult.success) {
        message.error(uploadResult.message || '媒體上傳失敗')
        return
      }
      
      imageUrl = uploadResult.data?.mediaUrl
      message.success('媒體上傳成功')
    }

    // 通過 Socket 發送，後端統一寫入資料庫與廣播
    const result = await socket.sendPrivateMessage(
      props.currentUserId, 
      props.friend.id, 
      content,
      imageUrl,
      replyTarget.value?.id ?? null
    )

    if (!result?.success) {
      message.error(result?.message || '發送失敗')
      return
    }

    messageContent.value = ''
    replyTarget.value = null
    clearImagePreview()
    emit('messageSent')
  } catch (error) {
    console.error('私聊消息發送失敗:', error)
    message.error((error as Error)?.message || '發送失敗，請稍後再試')
  } finally {
    isSending.value = false
    isUploading.value = false
    uploadProgress.value = 0
  }
}

const submitEdit = async () => {
  if (!editingMessage.value) {
    return
  }

  const content = String(editingContent.value).trim()
  if (!content) {
    message.error('消息內容不能為空')
    return
  }

  try {
    const result = await socket.updatePrivateMessage(
      props.currentUserId,
      props.friend.id,
      editingMessage.value.id,
      content
    )
    if (!result?.success) {
      message.error(result?.message || '編輯失敗')
      return
    }

    message.success('消息已更新')
    showEditModal.value = false
    editingMessage.value = null
    editingContent.value = ''
  } catch (error) {
    console.error('私聊消息編輯失敗:', error)
    message.error('編輯失敗，請稍後再試')
  }
}

const removePrivateMessage = async () => {
  if (!contextMenu.value.message) {
    return
  }

  if (contextMenu.value.message.senderId !== props.currentUserId) {
    hideContextMenu()
    return
  }

  try {
    const result = await socket.deletePrivateMessage(
      props.currentUserId,
      props.friend.id,
      contextMenu.value.message.id
    )
    if (!result?.success) {
      message.error(result?.message || '刪除失敗')
      return
    }

    message.success('消息已收回')
  } catch (error) {
    console.error('私聊消息刪除失敗:', error)
    message.error('刪除失敗，請稍後再試')
  } finally {
    hideContextMenu()
  }
}

const setupMessageListener = () => {
  // 先移除舊監聽器
  if (messageListener) {
    socket.offReceivePrivateMessage(messageListener)
  }

  if (privateMessageUpdatedListener) {
    socket.offPrivateMessageUpdated(privateMessageUpdatedListener)
  }

  if (privateMessageDeletedListener) {
    socket.offPrivateMessageDeleted(privateMessageDeletedListener)
  }

  // 創建新監聽器
  messageListener = (data: any) => {
    applyPrivateMessage(data)
  }

  privateMessageUpdatedListener = (data: any) => {
    applyUpdatedPrivateMessage(data)
  }

  privateMessageDeletedListener = (data: any) => {
    applyDeletedPrivateMessage(data)
  }

  socket.onReceivePrivateMessage(messageListener)
  if (privateMessageUpdatedListener) {
    socket.onPrivateMessageUpdated(privateMessageUpdatedListener)
  }
  if (privateMessageDeletedListener) {
    socket.onPrivateMessageDeleted(privateMessageDeletedListener)
  }
}

const applyPrivateSnapshot = (rawMessages: any[]) => {
  const normalizedMessages: Message[] = normalizeMessageSnapshot(rawMessages)

  chatStore.setPrivateMessages(props.currentUserId, props.friend.id, normalizedMessages)
  return normalizedMessages
}

const scrollToBottom = () => {
  if (messagesListRef.value) {
    messagesListRef.value.scrollTop = messagesListRef.value.scrollHeight
  }
}

const loadMessages = async () => {
  try {
    const cachedMessages = await chatCache.getPrivateMessages(props.currentUserId, props.friend.id)

    if (cachedMessages.length > 0) {
      applyPrivateSnapshot(cachedMessages)
      await nextTick()
      scrollToBottom()
    }

    const result = await chatService.fetchPrivateMessages(props.friend.id)
    if (result.success && result.data) {
      const normalizedMessages = applyPrivateSnapshot(result.data.messages || [])
      void chatCache.upsertPrivateMessages(props.currentUserId, props.friend.id, normalizedMessages)
      await nextTick()
      scrollToBottom()
    } else if (messages.value.length === 0) {
      message.error(result.error || '無法加載聊天記錄')
    }
  } catch (error) {
    console.error('載入私聊訊息失敗:', error)
    if (messages.value.length === 0) {
      message.error('無法加載聊天記錄')
    }
  }

  try {
    await chatService.markPrivateAsRead(props.friend.id)
  } catch (error) {
    console.warn('標記已讀失敗:', error)
  }
}

// 監聽好友變化時重新加載消息
watch(
  () => props.friend.id,
  async (newFriendId, oldFriendId) => {
    if (oldFriendId) {
      socket.leavePrivateChat(oldFriendId)
    }

    messageContent.value = ''
    replyTarget.value = null
    setupMessageListener()
    await syncPrivateSnapshotAndJoin()
  }
)

onMounted(() => {
  privateMissedMessagesListener = (events: any[]) => {
    if (!Array.isArray(events)) {
      return
    }

    events.forEach((event) => applyPrivateMessage(event))
  }

  connectListener = (recovered: boolean) => {
    if (recovered) {
      // Recovery 成功時會自動補漏事件，避免重送 join_private_chat。
      return
    }

    // 恢復失敗時，先以 HTTP 權威快照校正新增、編輯與刪除，再由 WS 補快照交界的新訊息。
    void syncPrivateSnapshotAndJoin()
  }

  socket.onPrivateMissedMessages(privateMissedMessagesListener)
  socket.onConnect(connectListener)
  setupMessageListener()
  void syncPrivateSnapshotAndJoin()
})

onUnmounted(() => {
  hideContextMenu()
  socket.leavePrivateChat(props.friend.id)

  if (messageListener) {
    socket.offReceivePrivateMessage(messageListener)
    messageListener = null
  }

  if (privateMissedMessagesListener) {
    socket.offPrivateMissedMessages(privateMissedMessagesListener)
    privateMissedMessagesListener = null
  }

  if (privateMessageUpdatedListener) {
    socket.offPrivateMessageUpdated(privateMessageUpdatedListener)
    privateMessageUpdatedListener = null
  }

  if (privateMessageDeletedListener) {
    socket.offPrivateMessageDeleted(privateMessageDeletedListener)
    privateMessageDeletedListener = null
  }

  if (connectListener) {
    socket.offConnect(connectListener)
    connectListener = null
  }
})
</script>

<style scoped lang="scss">
.private-chat-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: white;
  border-left: 1px solid #e8e8e8;
  border-right: 1px solid #e8e8e8;
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
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
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
  object-fit: cover;
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

.reply-preview {
  border-left: 3px solid #8b95d6;
  background: rgba(139, 149, 214, 0.14);
  border-radius: 6px;
  padding: 6px 8px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.reply-author {
  font-size: 12px;
  font-weight: 600;
}

.reply-content {
  font-size: 12px;
  opacity: 0.9;
}

.reply-media-thumb {
  width: 64px;
  height: 64px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid rgba(139, 149, 214, 0.35);
}

.reply-target-bar {
  border-top: 1px solid #e8e8e8;
  border-bottom: 1px solid #e8e8e8;
  padding: 10px 24px;
  background: #f7f8fc;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reply-target-text {
  font-size: 13px;
  color: #495057;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reply-cancel-btn {
  border: none;
  background: transparent;
  color: #667eea;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}

.reply-target-thumb {
  width: 40px;
  height: 40px;
  object-fit: cover;
  border-radius: 6px;
  border: 1px solid #d9d9d9;
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

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
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
  .btn-upload-media {
    padding: 8px 14px;
    border: 1px solid #d9d9d9;
    background: white;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: all 0.2s;
    white-space: nowrap;
    font-weight: 500;

    .upload-text {
      color: #666;
    }

    &:hover {
      border-color: #667eea;
      background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(168, 148, 199, 0.1) 100%);
      color: #667eea;

      .upload-text {
        color: #667eea;
      }
    }

    &:active {
      transform: scale(0.95);
    }
  }

  display: flex;
  align-items: center;
}

.file-input-hidden {
  display: none;
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

.upload-progress-bar {
  padding: 12px 24px;
  background: white;
  border-top: 1px solid #e8e8e8;
}

.progress-wrapper {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: #666;
}

.progress-text {
  font-weight: 500;
}

.progress-percent {
  font-weight: 600;
  color: #1890ff;
}

.progress-container {
  width: 100%;
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #1890ff, #52c41a);
  border-radius: 3px;
  transition: width 0.3s ease;
}
</style>
