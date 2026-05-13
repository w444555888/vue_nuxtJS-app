<template>
  <div class="chat-input-box">
    <!-- 输入框 -->
    <div class="input-container">
      <textarea
        v-model="messageText"
        @keydown.enter.ctrl="sendMessage"
        @keydown.enter.meta="sendMessage"
        placeholder="輸入訊息... (Ctrl+Enter 發送)"
        class="message-textarea"
        rows="2"
      ></textarea>
      <button @click="sendMessage" class="send-btn" :disabled="!messageText.trim()">
        <SendOutlined />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { SendOutlined } from '@antdv-next/icons'

const authStore = useAuthStore()
const chatStore = useChatStore()
const { sendMessage: sendSocketMessage } = useSocket()

const messageText = ref('')

const sendMessage = () => {
  if (!messageText.value.trim()) return
  if (!chatStore.currentRoom) {
    message.error('請先選擇訊息室')
    return
  }

  const content = messageText.value.trim()
  
  // 通过 Socket.io 发送消息
  sendSocketMessage(authStore.user.id, chatStore.currentRoom.id, content)
  
  // 清空输入框
  messageText.value = ''
}
</script>

<style scoped lang="css">
.chat-input-box {
  padding: 16px;
  border-top: 1px solid #e5e5e5;
  background: #fff;
}

.input-container {
  display: flex;
  gap: 8px;
  align-items: flex-end;
}

.message-textarea {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
  font-size: 14px;
  font-family: inherit;
  resize: none;
  outline: none;
  transition: border-color 0.2s;
  max-height: 120px;
}

.message-textarea:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.send-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  border: none;
  background: #667eea;
  color: white;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.send-btn:hover:not(:disabled) {
  background: #5568d3;
  transform: scale(1.05);
}

.send-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
  opacity: 0.5;
}
</style>
