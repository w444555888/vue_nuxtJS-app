<template>
  <Modal 
    :show="show" 
    title="選擇頭像"
    @update:show="(value) => emit('update:show', value)"
  >
    <div class="avatar-picker">
      <div class="style-selector">
        <label>選擇頭像風格：</label>
        <div class="style-buttons">
          <button 
            v-for="style in avatarStyles" 
            :key="style.value"
            :class="['style-btn', { active: selectedStyle === style.value }]"
            @click="selectedStyle = style.value"
          >
            {{ style.label }}
          </button>
        </div>
      </div>

      <!-- 自訂名字輸入 -->
      <div class="seed-input">
        <label>自訂名字（留空使用用戶名）：</label>
        <input 
          v-model="customSeed"
          type="text" 
          placeholder="輸入任意文字"
        />
      </div>

      <!-- 預覽 -->
      <div class="preview-section">
        <div class="preview-box">
          <img :src="previewUrl" :alt="previewUrl" />
        </div>
        <div class="preview-info">
          <p><strong>預覽：</strong></p>
          <p class="preview-url">{{ previewUrl }}</p>
        </div>
      </div>

      <!-- 預設選項 -->
      <div class="presets">
        <label>快速選擇：</label>
        <div class="preset-grid">
          <div 
            v-for="(preset, idx) in presetSeeds" 
            :key="idx"
            class="preset-item"
            @click="selectPreset(preset)"
          >
            <img :src="`https://api.dicebear.com/9.x/${selectedStyle}/svg?scale=50&seed=${preset}`" :alt="preset" />
            <span>{{ preset }}</span>
          </div>
        </div>
      </div>
    </div>

    <template #actions>
      <button @click="saveAvatar" class="btn-primary">保存</button>
      <button @click="emit('update:show', false)" class="btn-secondary">取消</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { message } from 'ant-design-vue'
import Modal from '~/components/Modal.vue'
import { useAuthStore } from '~/stores/auth'
import { useHttpClient } from '~/utils/httpClient'

interface Props {
  show: boolean
  currentUsername: string
}

const props = withDefaults(defineProps<Props>(), {
  show: false,
  currentUsername: ''
})

const emit = defineEmits<{
  'update:show': [value: boolean]
  'avatarUpdated': [avatar: string]
}>()

const authStore = useAuthStore()
const { post } = useHttpClient()

const avatarStyles = [
  { label: 'Pixel Art Neutral', value: 'pixel-art-neutral' },
  { label: 'Pixel Art', value: 'pixel-art' },
  { label: 'Adventurer', value: 'adventurer' },
  { label: 'Avataaars', value: 'avataaars' },
  { label: 'Bottts', value: 'bottts' },
  { label: 'Fun Emoji', value: 'fun-emoji' },
]

const presetSeeds = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry']

const selectedStyle = ref('pixel-art-neutral')
const customSeed = ref('')

const previewUrl = computed(() => {
  const seed = customSeed.value.trim() || props.currentUsername
  return `https://api.dicebear.com/9.x/${selectedStyle.value}/svg?scale=50&seed=${encodeURIComponent(seed)}`
})

const selectPreset = (preset: string) => {
  customSeed.value = preset
}

const saveAvatar = async () => {
  try {
    const seed = customSeed.value.trim() || props.currentUsername
    const avatarUrl = `https://api.dicebear.com/9.x/${selectedStyle.value}/svg?scale=50&seed=${encodeURIComponent(seed)}`
    const result = await post('/api/auth/update-avatar', {
      avatar: avatarUrl
    })

    if (result.success) {
      // 更新本地存儲和 authStore
      if (authStore.user) {
        authStore.user.avatar = avatarUrl
        // 保存到 localStorage
        const storedUser = JSON.parse(localStorage.getItem('auth_user') || '{}')
        storedUser.avatar = avatarUrl
        localStorage.setItem('auth_user', JSON.stringify(storedUser))
      }
      message.success('頭像已更新')
      emit('avatarUpdated', avatarUrl)
      emit('update:show', false)
    } else {
      message.error(result.message || '更新頭像失敗')
    }
  } catch (error) {
    console.error('更新頭像失敗:', error)
    message.error('更新頭像失敗')
  }
}

// 當 show 變化時重置表單
watch(() => props.show, (newVal) => {
  if (newVal) {
    selectedStyle.value = 'pixel-art-neutral'
    customSeed.value = ''
  }
})
</script>

<style scoped lang="scss">
.avatar-picker {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* 風格選擇 */
.style-selector {
  display: flex;
  flex-direction: column;
  gap: 12px;

  label {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }
}

.style-buttons {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

.style-btn {
  padding: 10px 12px;
  border: 2px solid #e8e8e8;
  background: white;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  transition: all 0.2s;

  &:hover {
    border-color: #667eea;
    color: #667eea;
  }

  &.active {
    background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
    color: white;
    border-color: transparent;
  }
}

/* 自訂種子 */
.seed-input {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }

  input {
    padding: 10px 12px;
    border: 1px solid #d9d9d9;
    border-radius: 6px;
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
}

/* 預覽 */
.preview-section {
  display: flex;
  gap: 16px;
  padding: 16px;
  background: #fafbfc;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
}

.preview-box {
  flex-shrink: 0;

  img {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    background: white;
    border: 2px solid #e8e8e8;
  }
}

.preview-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;

  p {
    margin: 0;
    font-size: 13px;
    color: #666;
  }

  strong {
    color: #333;
  }
}

.preview-url {
  word-break: break-all;
  font-size: 12px;
  color: #666;
  margin: 0;
}

/* 預設選項 */
.presets {
  display: flex;
  flex-direction: column;
  gap: 12px;

  label {
    font-size: 14px;
    font-weight: 600;
    color: #333;
  }
}

.preset-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.preset-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 12px;
  border: 2px solid #e8e8e8;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: white;

  &:hover {
    border-color: #667eea;
    background: #fafbfc;
  }

  img {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    object-fit: cover;
  }

  span {
    font-size: 12px;
    color: #666;
    font-weight: 500;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    width: 100%;
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

@media (max-width: 600px) {
  .style-buttons {
    grid-template-columns: 1fr;
  }

  .preset-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .preview-section {
    flex-direction: column;
    align-items: center;

    .preview-box img {
      width: 120px;
      height: 120px;
    }
  }
}
</style>
