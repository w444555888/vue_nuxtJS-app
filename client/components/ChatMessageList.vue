<template>
  <div class="message-list">
    <!-- 消息列表 -->
    <div class="messages-container" ref="messagesContainer">
      <div v-if="chatStore.messages.length === 0" class="empty-messages">
        <p>暂無訊息，開始訊天吧！</p>
      </div>

      <div 
        v-for="(message, index) in chatStore.messages" 
        :key="message.id"
        :class="['message-group', { 'is-own': isOwnMessage(message) }]"
      >
        <!-- 時間戳 -->
        <div 
          v-if="shouldShowTime(index)" 
          class="time-divider"
        >
          {{ formatTime(message.createdAt) }}
        </div>

        <!-- 消息 -->
        <div class="message-bubble-group">
          <img 
            v-if="!isOwnMessage(message)"
            :src="message.avatar || getDefaultAvatar(message.username)"
            :alt="message.username"
            class="avatar"
          />
          <div :class="['message-bubble', { 'is-own': isOwnMessage(message) }]">
            <div v-if="!isOwnMessage(message)" class="sender-name">
              {{ message.username }}
            </div>
            <div class="message-content">{{ message.content }}</div>
          </div>
        </div>
      </div>

      <div ref="messagesEnd"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'

const authStore = useAuthStore()
const chatStore = useChatStore()
const messagesContainer = ref<HTMLElement>()
const messagesEnd = ref<HTMLElement>()

// 检查消息是否是自己发送的
const isOwnMessage = (message: any) => {
  return message.userId === authStore.user?.id || message.username === authStore.user?.username
}

// 获取默认头像
const getDefaultAvatar = (username: string) => {
  const initial = username?.charAt(0).toUpperCase() || '?'
  return `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${username}`
}

// 検查是否需要顯示時間
const shouldShowTime = (index: number) => {
  if (index === 0) return true
  const current = new Date(chatStore.messages[index].createdAt)
  const previous = new Date(chatStore.messages[index - 1].createdAt)
  // 相隔超过5分钟显示时间
  return (current.getTime() - previous.getTime()) > 5 * 60 * 1000
}

// 格式化時間
const formatTime = (time: string) => {
  const date = new Date(time)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else if (date.toDateString() === yesterday.toDateString()) {
    return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  } else {
    return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
  }
}

// 自动滚到底部
watch(
  () => chatStore.messages.length,
  async () => {
    await nextTick()
    messagesEnd.value?.scrollIntoView({ behavior: 'smooth' })
  }
)
</script>

<style scoped lang="css">
.message-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 20px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.empty-messages {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14px;
}

.message-group {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.message-group.is-own {
  justify-content: flex-end;
}

.time-divider {
  width: 100%;
  text-align: center;
  color: #999;
  font-size: 12px;
  margin: 8px 0;
}

.message-bubble-group {
  display: flex;
  align-items: flex-end;
  gap: 8px;
}

.message-group.is-own .message-bubble-group {
  flex-direction: row-reverse;
}

.avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.message-bubble {
  max-width: 70%;
  padding: 10px 14px;
  border-radius: 12px;
  background: #f0f0f0;
  color: #333;
  word-break: break-word;
}

.message-bubble.is-own {
  background: #667eea;
  color: white;
}

.sender-name {
  font-size: 12px;
  color: #999;
  margin-bottom: 4px;
  font-weight: 500;
}

.message-bubble.is-own .sender-name {
  color: rgba(255, 255, 255, 0.7);
}

.message-content {
  font-size: 14px;
  line-height: 1.5;
}

/* 滚动条样式 */
.messages-container::-webkit-scrollbar {
  width: 6px;
}

.messages-container::-webkit-scrollbar-track {
  background: transparent;
}

.messages-container::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.messages-container::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
