<template>
  <div v-if="show" class="modal-overlay" @click.self="emit('update:show', false)">
    <div class="modal-content">
      <h2>{{ title }}</h2>
      <div class="modal-form">
        <slot />
      </div>
      <div class="modal-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
}>()

defineEmits<{
  'update:show': [value: boolean]
}>()
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
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
  animation: slideUp 0.3s ease;

  h2 {
    margin: 0 0 16px 0;
    font-size: 18px;
    color: #333;
    font-weight: 600;
  }
}

.modal-form {
  margin-bottom: 20px;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
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
