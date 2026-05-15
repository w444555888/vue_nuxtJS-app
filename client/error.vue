<template>
  <div class="error-container">
    <div class="error-content">
      <div class="error-code">{{ error?.status || '500' }}</div>
      <h1>{{ error?.statusText || '發生錯誤' }}</h1>
      <p class="error-message">
        {{ error?.message || '抱歉，發生了一個意外錯誤。' }}
      </p>
      
      <div class="error-actions">
        <button class="btn-primary" @click="handleReturn">
          返回首頁
        </button>
        <button class="btn-secondary" @click="handleClearError">
          重新嘗試
        </button>
      </div>

      <!-- 開發環境顯示詳細錯誤 -->
      <div v-if="isDev" class="error-details">
        <details>
          <summary>錯誤詳情（開發環境）</summary>
          <pre>{{ error }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps({
  error: Object as () => NuxtError,
})

const isDev = import.meta.env.DEV

// 返回首頁
const handleReturn = async () => {
  await navigateTo('/')
}

// 清除錯誤並重試
const handleClearError = async () => {
  await clearError({ redirect: '/' })
}
</script>

<style scoped lang="scss">
.error-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  padding: 20px;
}

.error-content {
  background: white;
  border-radius: 12px;
  padding: 40px;
  max-width: 500px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  text-align: center;
}

.error-code {
  font-size: 72px;
  font-weight: bold;
  color: #667eea;
  margin-bottom: 16px;
  line-height: 1;
}

h1 {
  font-size: 28px;
  color: #333;
  margin: 0 0 12px 0;
}

.error-message {
  color: #666;
  font-size: 16px;
  margin: 0 0 32px 0;
  line-height: 1.6;
}

.error-actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  flex-wrap: wrap;
  justify-content: center;

  .btn-primary,
  .btn-secondary {
    padding: 10px 24px;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    cursor: pointer;
    transition: all 0.3s ease;
    flex: 1;
    min-width: 120px;
  }

  .btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
    color: white;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(102, 126, 234, 0.3);
    }
  }

  .btn-secondary {
    background: #f0f0f0;
    color: #333;

    &:hover {
      background: #e0e0e0;
    }
  }
}

.error-details {
  margin-top: 24px;
  text-align: left;
  background: #f5f5f5;
  padding: 16px;
  border-radius: 6px;

  details {
    cursor: pointer;

    summary {
      font-weight: 500;
      color: #667eea;
      user-select: none;

      &:hover {
        text-decoration: underline;
      }
    }

    pre {
      margin: 12px 0 0 0;
      overflow: auto;
      background: white;
      padding: 12px;
      border-radius: 4px;
      font-size: 12px;
      color: #333;
    }
  }
}

@media (max-width: 480px) {
  .error-content {
    padding: 24px;
  }

  .error-code {
    font-size: 48px;
  }

  h1 {
    font-size: 20px;
  }

  .error-actions {
    .btn-primary,
    .btn-secondary {
      padding: 8px 16px;
      font-size: 13px;
    }
  }
}
</style>
