<template>
  <div class="ai-customer-service">
    <!-- 消息歷史 -->
    <div class="messages-container">
      <div v-if="messages.length === 0" class="welcome-message">
        <div class="welcome-icon">
         <OpenAIOutlined />
        </div>
        <h3>AI 客服助手</h3>
        <p>歡迎！我是您的 AI 客服助手</p>
        <p class="welcome-tip">
          我可以幫助您解決聊天軟體的各種問題
        </p>
      </div>
      
      <div v-for="(msg, idx) in messages" :key="idx" :class="['message', msg.type]">
        <div v-if="msg.type === 'user'" class="message-content">
          {{ msg.text }}
        </div>
        <div v-else class="message-content">
          {{ msg.text }}
        </div>
      </div>

      <!-- 加載指示器 -->
      <div v-if="isLoading" class="message ai">
        <div class="message-content">
          <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </div>

      <!-- 錯誤提示 -->
      <div v-if="errorMessage" class="message error">
        <div class="message-content">
          <WarningOutlined class="error-icon" />
          {{ errorMessage }}
        </div>
      </div>
    </div>

    <!-- 輸入框 -->
    <div class="input-section">
      <input 
        v-model="userMessage" 
        type="text" 
        placeholder="輸入您的問題..." 
        class="message-input"
        :disabled="isLoading"
        @keyup.enter="sendMessage"
      >
      <button 
        @click="sendMessage" 
        :disabled="isLoading || !userMessage.trim()"
        class="btn-send"
      >
        <span v-if="!isLoading">發送</span>
        <span v-else>...</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAiService } from '~/composables/useAiService'
import { OpenAIOutlined, WarningOutlined } from '@antdv-next/icons'

interface Message {
  type: 'user' | 'ai'
  text: string
  timestamp?: Date
}

const aiService = useAiService()

const messages = ref<Message[]>([])
const userMessage = ref('')
const isLoading = ref(false)
const errorMessage = ref('')

const sendMessage = async () => {
  if (!userMessage.value.trim()) {
    return
  }

  messages.value.push({
    type: 'user',
    text: userMessage.value,
    timestamp: new Date()
  })

  const currentMessage = userMessage.value
  userMessage.value = ''
  isLoading.value = true
  errorMessage.value = ''

  try {
    const result = await aiService.sendMessage(currentMessage)
    if (result.success && result.data) {
      messages.value.push({
        type: 'ai',
        text: result.data.message,
        timestamp: result.data.timestamp || new Date()
      })
    } else {
      errorMessage.value = result.message || '無法獲取回應，請稍後重試'
    }
  } catch (error: any) {
    console.error('發送消息失敗:', error)
    errorMessage.value = '連接失敗，請檢查網路並重試'
  } finally {
    isLoading.value = false
  }
}

// 清除消息歷史
const clearHistory = () => {
  if (confirm('確定要清除所有對話歷史嗎？')) {
    messages.value = []
    errorMessage.value = ''
  }
}

defineExpose({
  clearHistory
})
</script>

<style scoped lang="scss">
.ai-customer-service {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #f9f9f9;
  border-radius: 8px;
  overflow: hidden;

  .messages-container {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;

    @media (max-width: 768px) {
      padding: 12px;
      gap: 10px;
    }

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-track {
      background: transparent;
    }

    &::-webkit-scrollbar-thumb {
      background: #ddd;
      border-radius: 3px;

      &:hover {
        background: #999;
      }
    }

    .welcome-message {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      text-align: center;
      color: #666;

      .welcome-icon {
        font-size: 48px;
        margin-bottom: 16px;

        @media (max-width: 768px) {
          font-size: 40px;
          margin-bottom: 12px;
        }

        @media (max-width: 480px) {
          font-size: 32px;
          margin-bottom: 10px;
        }
      }

      h3 {
        margin: 0;
        font-size: 18px;
        color: #333;
        margin-bottom: 8px;

        @media (max-width: 480px) {
          font-size: 16px;
          margin-bottom: 6px;
        }
      }

      p {
        margin: 4px 0;
        font-size: 14px;

        @media (max-width: 480px) {
          font-size: 13px;
          margin: 3px 0;
        }
      }

      .welcome-tip {
        font-size: 12px;
        color: #999;
        margin-top: 8px;

        @media (max-width: 480px) {
          font-size: 11px;
          margin-top: 6px;
        }
      }
    }

    .message {
      display: flex;
      margin: 0;
      animation: slideIn 0.3s ease-out;

      &.user {
        justify-content: flex-end;

        .message-content {
          background: #007bff;
          color: white;
          border-radius: 12px 12px 4px 12px;
        }
      }

      &.ai {
        justify-content: flex-start;

        .message-content {
          background: white;
          color: #333;
          border: 1px solid #e0e0e0;
          border-radius: 12px 12px 12px 4px;
        }
      }

      &.error {
        justify-content: flex-start;

        .message-content {
          background: #ffe0e0;
          color: #c33;
          border: 1px solid #ffcccc;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;

          .error-icon {
            color: #c33;
            font-size: 18px;
            margin: 0;
            flex-shrink: 0;
          }
        }
      }

      .message-content {
        max-width: 70%;
        padding: 10px 14px;
        word-wrap: break-word;
        white-space: pre-wrap;
        line-height: 1.5;
        font-size: 14px;

        @media (max-width: 768px) {
          max-width: 80%;
          padding: 8px 12px;
          font-size: 13px;
        }

        @media (max-width: 480px) {
          max-width: 90%;
          padding: 8px 12px;
          font-size: 13px;
        }
      }
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      align-items: center;

      span {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #999;
        animation: typing 1.4s infinite;

        &:nth-child(2) {
          animation-delay: 0.2s;
        }

        &:nth-child(3) {
          animation-delay: 0.4s;
        }
      }
    }
  }

  .input-section {
    display: flex;
    gap: 8px;
    padding: 12px;
    background: white;

    @media (max-width: 480px) {
      gap: 6px;
      padding: 10px;
    }

    .message-input {
      flex: 1;
      border: 1px solid #ddd;
      border-radius: 4px;
      padding: 8px 12px;
      font-size: 14px;
      font-family: inherit;

      @media (max-width: 480px) {
        padding: 8px 10px;
        font-size: 13px;
      }

      &:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
      }

      &:disabled {
        background: #f5f5f5;
        color: #999;
        cursor: not-allowed;
      }
    }

    .btn-send {
      background: #007bff;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s;
      white-space: nowrap;

      @media (max-width: 480px) {
        padding: 8px 12px;
        font-size: 13px;
      }

      &:hover:not(:disabled) {
        background: #0056b3;
      }

      &:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
    }
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

@keyframes typing {
  0%, 60%, 100% {
    opacity: 0.3;
  }
  30% {
    opacity: 1;
  }
}
</style>
