<template>
  <div v-if="show" class="modal-overlay" @click.self="handleCancel">
    <div class="modal-content confirm-modal">
      <div class="confirm-icon" :class="type">
        <span v-if="type === 'danger'">!</span>
        <span v-else-if="type === 'warning'">⚠</span>
        <span v-else>?</span>
      </div>
      <h2>{{ title }}</h2>
      <p class="confirm-message">{{ message }}</p>
      <div class="modal-actions">
        <button @click="handleCancel" class="btn-secondary">取消</button>
        <button @click="handleConfirm" :class="['btn-confirm', type]">
          {{ confirmText || '確認' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
  message: string
  confirmText?: string
  type?: 'danger' | 'warning' | 'info'
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const handleConfirm = () => {
  emit('confirm')
}

const handleCancel = () => {
  emit('cancel')
}
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s ease;

  h2 {
    margin: 0 0 12px 0;
    font-size: 18px;
    color: #333;
    font-weight: 600;
  }
}

.confirm-modal {
  text-align: center;
  padding: 32px 24px;
}

.confirm-icon {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  font-weight: bold;
  margin: 0 auto 16px;

  &.danger {
    background: rgba(248, 37, 37, 0.1);
    color: #f82525;
  }

  &.warning {
    background: rgba(255, 159, 64, 0.1);
    color: #ff9f40;
  }

  &.info {
    background: rgba(102, 126, 234, 0.1);
    color: #667eea;
  }
}

.confirm-message {
  margin: 0 0 24px 0;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.btn-secondary {
  padding: 10px 24px;
  background: #f0f0f0;
  color: #333;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;

  &:hover {
    background: #e8e8e8;
  }
}

.btn-confirm {
  padding: 10px 24px;
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 100px;

  &.danger {
    background: #f82525;

    &:hover {
      background: #ff5252;
      box-shadow: 0 4px 12px rgba(248, 37, 37, 0.3);
    }
  }

  &.warning {
    background: #ff9f40;

    &:hover {
      background: #ffb366;
      box-shadow: 0 4px 12px rgba(255, 159, 64, 0.3);
    }
  }

  &.info {
    background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
    }
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
</style>
