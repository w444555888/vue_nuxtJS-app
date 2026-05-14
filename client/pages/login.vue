<template>
  <div class="auth-container">
    <div class="auth-box">
      <!-- Logo -->
      <div class="logo-section">
        <div class="logo"> <MessageCircle :size="34" stroke-width="1.5" /></div>
        <div class="logo-text">聊天室</div>
      </div>

      <div class="tabs">
        <button 
          :class="['tab', { active: isLogin }]"
          @click="isLogin = true"
        >
          登入
        </button>
        <button 
          :class="['tab', { active: !isLogin }]"
          @click="isLogin = false"
        >
          註冊
        </button>
      </div>

      <!-- 登入表單 -->
      <form v-if="isLogin" @submit.prevent="handleLogin" class="form">
        <div class="form-group">
          <label>郵箱</label>
          <input 
            v-model="loginForm.email"
            type="email" 
            placeholder="請輸入郵箱" 
            required
          />
        </div>
        <div class="form-group">
          <label>密碼</label>
          <input 
            v-model="loginForm.password"
            type="password" 
            placeholder="請輸入密碼" 
            required
          />
        </div>
        <button type="submit" class="submit-btn" :disabled="authStore.isLoading">
          {{ authStore.isLoading ? '登入中...' : '登入' }}
        </button>
      </form>

      <!-- 註冊表單 -->
      <form v-else @submit.prevent="handleRegister" class="form">
        <div class="form-group">
          <label>郵箱</label>
          <input 
            v-model="registerForm.email"
            type="email" 
            placeholder="請輸入郵箱" 
            required
          />
        </div>
        <div class="form-group">
          <label>用戶名</label>
          <input 
            v-model="registerForm.username"
            type="text" 
            placeholder="請輸入用戶名" 
            required
          />
        </div>
        <div class="form-group">
          <label>密碼</label>
          <input 
            v-model="registerForm.password"
            type="password" 
            placeholder="請輸入密碼（至少6位）" 
            minlength="6"
            required
          />
        </div>
        <button type="submit" class="submit-btn" :disabled="authStore.isLoading">
          {{ authStore.isLoading ? '註冊中...' : '註冊' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { MessageCircle } from 'lucide-vue-next'
import { message } from 'ant-design-vue'

const isLogin = ref(true)
const router = useRouter()
const authService = useAuthService()
const authStore = useAuthStore()

const loginForm = ref({
  email: '',
  password: ''
})

const registerForm = ref({
  email: '',
  username: '',
  password: ''
})

const handleLogin = async () => {
  if (!loginForm.value.email || !loginForm.value.password) {
    message.error('郵箱和密碼不能為空')
    return
  }
  
  const result = await authService.login(
    loginForm.value.email,
    loginForm.value.password
  )
  
  if (result.success) {
    message.success(result.message || '登入成功！')
    loginForm.value = { email: '', password: '' }
    setTimeout(() => {
      router.push('/chat')
    }, 600)
  } else {
    message.error(result.message || '登入失敗，請重試')
  }
}

const handleRegister = async () => {
  if (registerForm.value.password.length < 6) {
    message.error('密碼至少需要6位')
    return
  }
  
  if (!registerForm.value.email || !registerForm.value.username) {
    message.error('所有欄位都不能為空')
    return
  }
  
  const result = await authService.register(
    registerForm.value.email,
    registerForm.value.username,
    registerForm.value.password
  )
  
  if (result.success) {
    message.success(result.message || '註冊成功！')
    registerForm.value = { email: '', username: '', password: '' }
    setTimeout(() => {
      router.push('/chat')
    }, 600)
  } else {
    message.error(result.message || '註冊失敗，請重試')
  }
}
</script>

<style scoped lang="css">
.auth-container {
  width: 100%;
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
}

.auth-box {
  width: 100%;
  max-width: 400px;
  padding: 40px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
}

.logo-section {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  font-size: 48px;
  margin-bottom: 12px;
}

.logo-text {
  margin: 0;
  font-size: 28px;
  color: #333;
  font-weight: 600;
}

.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 32px;
  border-bottom: 2px solid #f0f0f0;
}

.tab {
  flex: 1;
  padding: 12px;
  border: none;
  background: none;
  color: #999;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
  margin-bottom: -2px;
}

.tab.active {
  color: #667eea;
  border-bottom-color: #667eea;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-group label {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.form-group input {
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.form-group input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.submit-btn {
  padding: 12px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  color: white;
  font-size: 16px;
  font-weight: 600;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  margin-top: 8px;
}

.submit-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(102, 126, 234, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
