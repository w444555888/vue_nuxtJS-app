<template>
  <Modal 
    :show="show" 
    title="自訂頭像 - Pixel Art"
    @update:show="(value) => emit('update:show', value)"
  >
    <div class="avatar-picker">
      <!-- 自訂選項 -->
      <div class="customization-options">
        <div class="option-group">
          <label>眼睛：</label>
          <div class="option-buttons">
            <button 
              v-for="eye in eyesVariants" 
              :key="eye"
              :class="['option-btn', { active: customOptions.eyes === eye }]"
              @click="customOptions.eyes = eye"
            >
              {{ eye }}
            </button>
          </div>
        </div>

        <!-- 眼睛顏色 -->
        <div class="option-group">
          <label>眼睛顏色：</label>
          <div class="color-picker">
            <input 
              v-model="customOptions.eyesColor"
              type="color"
              class="color-input"
            />
            <span class="color-value">#{{ customOptions.eyesColor.substring(1).toUpperCase() }}</span>
          </div>
        </div>

        <div class="option-group">
          <label>嘴巴：</label>
          <div class="option-buttons">
            <button 
              v-for="mouth in mouthVariants" 
              :key="mouth"
              :class="['option-btn', { active: customOptions.mouth === mouth }]"
              @click="customOptions.mouth = mouth"
            >
              {{ mouth }}
            </button>
          </div>
        </div>

        <div class="option-group">
          <label>嘴巴顏色：</label>
          <div class="color-picker">
            <input 
              v-model="customOptions.mouthColor"
              type="color"
              class="color-input"
            />
            <span class="color-value">#{{ customOptions.mouthColor.substring(1).toUpperCase() }}</span>
          </div>
        </div>

        <div class="option-group">
          <label>
            <input 
              v-model="customOptions.showGlasses"
              type="checkbox"
              class="checkbox-input"
            />
            顯示眼鏡
          </label>
        </div>

        <div class="option-group" v-if="customOptions.showGlasses">
          <label>眼鏡類型：</label>
          <div class="option-buttons">
            <button 
              v-for="glass in glassesVariants" 
              :key="glass"
              :class="['option-btn', { active: customOptions.glasses === glass }]"
              @click="customOptions.glasses = glass"
            >
              {{ glass }}
            </button>
          </div>
        </div>

        <div class="option-group">
          <label>眼鏡顏色：</label>
          <div class="color-picker">
            <input 
              v-model="customOptions.glassesColor"
              type="color"
              class="color-input"
            />
            <span class="color-value">#{{ customOptions.glassesColor.substring(1).toUpperCase() }}</span>
          </div>
        </div>

        <div class="option-group">
          <label>
            <input 
              v-model="customOptions.flip"
              type="checkbox"
              class="checkbox-input"
            />
            翻轉頭像
          </label>
        </div>

        <div class="option-group">
          <label>背景顏色：</label>
          <div class="color-picker">
            <input 
              v-model="customOptions.backgroundColor"
              type="color"
              class="color-input"
            />
            <span class="color-value">#{{ customOptions.backgroundColor.substring(1).toUpperCase() }}</span>
          </div>
        </div>

        <div class="option-group">
          <label>背景類型：</label>
          <div class="option-buttons">
            <button 
              v-for="type in backgroundTypes" 
              :key="type"
              :class="['option-btn', { active: customOptions.backgroundType === type }]"
              @click="customOptions.backgroundType = type as 'solid' | 'gradientLinear'"
            >
              {{ type === 'solid' ? '純色' : '漸變' }}
            </button>
          </div>
        </div>

        <div class="option-group" v-if="customOptions.backgroundType === 'gradientLinear'">
          <label>漸變第二顏色：</label>
          <div class="color-picker">
            <input 
              v-model="customOptions.backgroundColorSecond"
              type="color"
              class="color-input"
            />
            <span class="color-value">#{{ customOptions.backgroundColorSecond.substring(1).toUpperCase() }}</span>
          </div>
        </div>

        <div class="option-group" v-if="customOptions.backgroundType === 'gradientLinear'">
          <label>漸變旋轉（0-360）：</label>
          <div class="slider-container">
            <input 
              v-model.number="customOptions.backgroundRotation"
              type="range"
              min="0"
              max="360"
              class="slider"
            />
            <span class="slider-value">{{ customOptions.backgroundRotation }}°</span>
          </div>
        </div>
      </div>

      <!-- 預覽 -->
      <div class="preview-section">
        <div class="preview-box">
          <img :src="previewUrl" :alt="previewUrl" class="preview-img" />
        </div>
        <button @click="randomizeAll" class="btn-randomize">
          <ReloadOutlined />
          <span>隨機</span>
        </button>
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
import { ReloadOutlined } from '@antdv-next/icons'
import Modal from '~/components/Modal.vue'
import { useAuthStore } from '~/stores/auth'
import { useHttpClient } from '~/utils/httpClient'

interface Props {
  show: boolean
  currentAvatarUrl: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:show': [value: boolean]
  'avatarUpdated': [avatar: string]
}>()

const authStore = useAuthStore()
const { post } = useHttpClient()

// Pixel Art Neutral 的選項
const eyesVariants = ['variant01', 'variant02', 'variant03', 'variant04', 'variant05', 'variant06', 'variant07', 'variant08', 'variant09', 'variant10', 'variant11', 'variant12']
const mouthVariants = ['happy01', 'happy02', 'happy03', 'happy04', 'happy05', 'happy06', 'happy07', 'happy08', 'happy09', 'happy10', 'happy11', 'happy12', 'happy13', 'sad01', 'sad02', 'sad03', 'sad04', 'sad05', 'sad06', 'sad07', 'sad08', 'sad09', 'sad10']
const glassesVariants = ['dark01', 'dark02', 'dark03', 'dark04', 'dark05', 'dark06', 'dark07', 'light01', 'light02', 'light03', 'light04', 'light05', 'light06', 'light07']
const backgroundTypes = ['solid', 'gradientLinear']

interface CustomOptions {
  seed: string
  eyes: string
  eyesColor: string
  mouth: string
  mouthColor: string
  glasses: string
  glassesColor: string
  showGlasses: boolean
  flip: boolean
  backgroundColor: string
  backgroundColorSecond: string
  backgroundType: 'solid' | 'gradientLinear'
  backgroundRotation: number
}

const customOptions = ref<CustomOptions>({
  seed: 'avatar',
  eyes: 'variant01',
  eyesColor: '#5b7c8b',
  mouth: 'happy01',
  mouthColor: '#c98276',
  glasses: 'dark01',
  glassesColor: '#4b4b4b',
  showGlasses: false,
  flip: false,
  backgroundColor: '#b6e3f4',
  backgroundColorSecond: '#c0aede',
  backgroundType: 'solid',
  backgroundRotation: 0
})

const previewUrl = computed(() => {
  const params = new URLSearchParams()
  
  params.append('seed', customOptions.value.seed)
  params.append('eyes', customOptions.value.eyes)
  params.append('eyesColor', customOptions.value.eyesColor.substring(1))
  params.append('eyesProbability', '100')
  params.append('mouth', customOptions.value.mouth)
  params.append('mouthColor', customOptions.value.mouthColor.substring(1))
  params.append('mouthProbability', '100')
  params.append('flip', String(customOptions.value.flip))
  
  if (customOptions.value.backgroundType === 'gradientLinear') {
    params.append('backgroundColor', customOptions.value.backgroundColor.substring(1) + ',' + customOptions.value.backgroundColorSecond.substring(1))
    params.append('backgroundRotation', String(customOptions.value.backgroundRotation))
  } else {
    params.append('backgroundColor', customOptions.value.backgroundColor.substring(1))
  }
  
  params.append('backgroundType', customOptions.value.backgroundType)
  params.append('scale', '50')
  
  if (customOptions.value.showGlasses) {
    params.append('glasses', customOptions.value.glasses)
    params.append('glassesColor', customOptions.value.glassesColor.substring(1))
    params.append('glassesProbability', '100')
  } else {
    params.append('glassesProbability', '0')
  }

  return `https://api.dicebear.com/9.x/pixel-art-neutral/svg?${params.toString()}`
})

const getRandomColor = () => {
  return `#${Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0')}`
}

const randomizeAll = () => {
  customOptions.value.eyes = eyesVariants[Math.floor(Math.random() * eyesVariants.length)] as string
  customOptions.value.eyesColor = getRandomColor()
  customOptions.value.mouth = mouthVariants[Math.floor(Math.random() * mouthVariants.length)] as string
  customOptions.value.mouthColor = getRandomColor()
  customOptions.value.flip = Math.random() > 0.5
  customOptions.value.showGlasses = Math.random() > 0.4
  customOptions.value.backgroundType = Math.random() > 0.5 ? 'solid' : 'gradientLinear'
  customOptions.value.backgroundColor = getRandomColor()
  if (customOptions.value.backgroundType === 'gradientLinear') {
    customOptions.value.backgroundColorSecond = getRandomColor()
    customOptions.value.backgroundRotation = Math.floor(Math.random() * 360)
  }
  if (customOptions.value.showGlasses) {
    customOptions.value.glasses = glassesVariants[Math.floor(Math.random() * glassesVariants.length)] as string
    customOptions.value.glassesColor = getRandomColor()
  }
}

const saveAvatar = async () => {
  try {
    const avatarUrl = previewUrl.value
    const result = await post('/api/auth/update-avatar', {
      avatar: avatarUrl
    })

    if (result.success) {
      if (authStore.user) {
        authStore.user.avatar = avatarUrl
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

const initializeFromUrl = (url: string) => {
  try {
    const urlParams = new URLSearchParams(new URL(url).search)
    
    customOptions.value = {
      seed: urlParams.get('seed') || 'avatar',
      eyes: urlParams.get('eyes') || 'variant01',
      eyesColor: '#' + (urlParams.get('eyesColor') || '5b7c8b'),
      mouth: urlParams.get('mouth') || 'happy01',
      mouthColor: '#' + (urlParams.get('mouthColor') || 'c98276'),
      glasses: urlParams.get('glasses') || 'dark01',
      glassesColor: '#' + (urlParams.get('glassesColor') || '4b4b4b'),
      showGlasses: urlParams.get('glassesProbability') === '100',
      flip: urlParams.get('flip') === 'true',
      backgroundColor: '#' + (urlParams.get('backgroundColor')?.split(',')[0] || 'b6e3f4'),
      backgroundColorSecond: '#' + (urlParams.get('backgroundColor')?.split(',')[1] || 'c0aede'),
      backgroundType: (urlParams.get('backgroundType') || 'solid') as 'solid' | 'gradientLinear',
      backgroundRotation: parseInt(urlParams.get('backgroundRotation') || '0')
    }
  } catch (error) {
    console.error('Failed to parse avatar URL:', error)
    resetOptions()
  }
}

const resetOptions = () => {
  customOptions.value = {
    seed: 'avatar',
    eyes: 'variant01',
    eyesColor: '#5b7c8b',
    mouth: 'happy01',
    mouthColor: '#c98276',
    glasses: 'dark01',
    glassesColor: '#4b4b4b',
    showGlasses: false,
    flip: false,
    backgroundColor: '#b6e3f4',
    backgroundColorSecond: '#c0aede',
    backgroundType: 'solid',
    backgroundRotation: 0
  }
}

// 當 show 變化時重置表單
watch(() => props.show, (newVal) => {
  if (newVal) {
    initializeFromUrl(props.currentAvatarUrl)
  }
})
</script>

<style scoped lang="scss">
.avatar-picker {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* 自訂選項 */
.customization-options {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
}

.option-group {
  display: flex;
  flex-direction: column;
  gap: 8px;

  label {
    font-size: 13px;
    font-weight: 600;
    color: #333;
    display: flex;
    align-items: center;
    gap: 6px;
  }
}

.option-buttons {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
  gap: 8px;
}

.option-btn {
  padding: 8px 10px;
  border: 1px solid #d9d9d9;
  background: white;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
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

.color-picker {
  display: flex;
  align-items: center;
  gap: 12px;
}

.color-input {
  width: 50px;
  height: 40px;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  cursor: pointer;
}

.color-value {
  font-size: 12px;
  color: #666;
  font-family: 'Courier New', monospace;
}

.slider-container {
  display: flex;
  align-items: center;
  gap: 12px;
}

.slider {
  flex: 1;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(to right, #d9d9d9 0%, #667eea 100%);
  outline: none;
  -webkit-appearance: none;
  appearance: none;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    border: 2px solid #667eea;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      transform: scale(1.2);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }
  }

  &::-moz-range-thumb {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: white;
    border: 2px solid #667eea;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      transform: scale(1.2);
      box-shadow: 0 2px 8px rgba(102, 126, 234, 0.3);
    }
  }
}

.slider-value {
  min-width: 40px;
  font-size: 12px;
  color: #666;
  font-weight: 500;
}

/* 預覽 */
.preview-section {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
  border-radius: 8px;
  border: 2px dashed #667eea;
}

.preview-box {
  flex-shrink: 0;

  .preview-img {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: white;
    border: 3px solid white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.btn-randomize {
  padding: 10px 16px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  color: white;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  display: inline-flex;
  align-items: center;
  gap: 8px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
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
  background: #e8e8e8;
  color: #333;

  &:hover {
    background: #d9d9d9;
  }
}

@media (max-width: 768px) {
  .option-buttons {
    grid-template-columns: repeat(auto-fill, minmax(60px, 1fr));
  }

  .preview-section {
    flex-direction: column;
  }
}
</style>


