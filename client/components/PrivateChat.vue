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
    <div class="messages-container">
      <div v-if="messages.length === 0" class="empty-messages">
        暫無消息，開始對話吧
      </div>
      <div v-else class="messages-list">
        <div 
          v-for="msg in messages" 
          :key="msg.id" 
          :class="['message-item', { own: msg.senderId === currentUserId }]"
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
            <div class="message-text">{{ msg.content }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- 私聊輸入框 -->
    <div class="chat-input-area">
      <input 
        v-model="messageContent"
        type="text" 
        placeholder="輸入消息..." 
        class="chat-input"
        @keyup.enter="sendMessage"
      >
      <button @click="sendMessage" class="btn-send">發送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import dayjs from 'dayjs'
import { message } from 'ant-design-vue'

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
const socket = useSocket()

const messages = ref<Message[]>([])
const messageContent = ref('')
let messageListener: ((data: any) => void) | null = null
let privateMissedMessagesListener: ((data: any[]) => void) | null = null
let connectListener: (() => void) | null = null
const messageIdSet = ref<Set<number>>(new Set())

const getLastSeq = () => {
  return messages.value.reduce((maxSeq, item) => {
    const seqValue = Number(item.seq ?? item.id ?? 0)
    return seqValue > maxSeq ? seqValue : maxSeq
  }, 0)
}

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

  if (messageIdSet.value.has(messageId)) {
    return
  }

  messageIdSet.value.add(messageId)
  messages.value.push({
    id: messageId,
    seq: Number(data?.seq || messageId),
    content: data.content,
    senderId: data.senderId,
    senderName: data.senderName,
    senderAvatar: data.senderAvatar,
    receiverId: data.receiverId,
    isRead: data.isRead,
    createdAt: data.createdAt
  })
}

const joinPrivateWithRecovery = () => {
  socket.joinPrivateChatWithSeq(props.currentUserId, props.friend.id, getLastSeq())
}

const formatTime = (timestamp: string) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}

const closeChat = () => {
  if (messageListener) {
    socket.offReceivePrivateMessage(messageListener)
    messageListener = null
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
  if (!messageContent.value.trim()) {
    message.error('請輸入消息內容')
    return
  }

  try {
    const content = messageContent.value.trim()

    // 通過 Socket 發送，後端統一寫入資料庫與廣播
    const result = await socket.sendPrivateMessage(props.currentUserId, props.friend.id, content)

    if (!result?.success) {
      message.error(result?.message || '發送失敗')
      return
    }

    messageContent.value = ''
    emit('messageSent')
  } catch (error) {
    console.error('私聊消息發送失敗:', error)
    message.error('發送失敗，請稍後再試')
  }
}

const setupMessageListener = () => {
  // 先移除舊監聽器
  if (messageListener) {
    socket.offReceivePrivateMessage(messageListener)
  }

  // 創建新監聽器
  messageListener = (data: any) => {
    applyPrivateMessage(data)
  }

  socket.onReceivePrivateMessage(messageListener)
}

const loadMessages = async () => {
  const result = await chatService.fetchPrivateMessages(props.friend.id)
  if (result.success && result.data) {
    const sortedMessages = [...(result.data.messages || [])].sort((a: any, b: any) => (a.id || 0) - (b.id || 0))
    messages.value = sortedMessages.map((item: any) => ({ ...item, seq: item.id }))
    messageIdSet.value = new Set(messages.value.map((item) => item.id))

    // 加入私聊 Socket 房間
    joinPrivateWithRecovery()

    // 標記消息為已讀
    await chatService.markPrivateAsRead(props.friend.id)

    // 設置消息監聽器
    setupMessageListener()

    console.log(`開始與 ${props.friend.username} 的私聊`)
  } else {
    message.error(result.error || '無法加載聊天記錄')
  }
}

// 監聽好友變化時重新加載消息
watch(
  () => props.friend.id,
  (newFriendId, oldFriendId) => {
    if (oldFriendId) {
      socket.leavePrivateChat(oldFriendId)
    }

    messages.value = []
    messageIdSet.value = new Set()
    messageContent.value = ''
    loadMessages()
  }
)

onMounted(() => {
  privateMissedMessagesListener = (events: any[]) => {
    if (!Array.isArray(events)) {
      return
    }

    events.forEach((event) => applyPrivateMessage(event))
  }

  connectListener = () => {
    joinPrivateWithRecovery()
  }

  socket.onPrivateMissedMessages(privateMissedMessagesListener)
  socket.onConnect(connectListener)
  loadMessages()
})

onUnmounted(() => {
  socket.leavePrivateChat(props.friend.id)

  if (messageListener) {
    socket.offReceivePrivateMessage(messageListener)
    messageListener = null
  }

  if (privateMissedMessagesListener) {
    socket.offPrivateMissedMessages(privateMissedMessagesListener)
    privateMissedMessagesListener = null
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
