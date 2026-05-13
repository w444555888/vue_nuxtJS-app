<template>
  <div class="chat-header">
    <div class="header-left">
      <div class="room-name">{{ chatStore.currentRoom?.name }}</div>
      <p class="room-members">{{ onlineCount }} 人在線</p>
    </div>
    <div class="header-right">
      <button class="icon-btn" title="設置">
        <SettingOutlined />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SettingOutlined } from '@antdv-next/icons'

const chatStore = useChatStore()

const onlineCount = computed(() => {
  return chatStore.onlineUsers.length || 0
})
</script>

<style scoped lang="css">
.chat-header {
  padding: 16px;
  border-bottom: 1px solid #e5e5e5;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.header-left {
  flex: 1;
}

.room-name {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.room-members {
  margin: 4px 0 0 0;
  font-size: 12px;
  color: #999;
}

.header-right {
  display: flex;
  gap: 8px;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  background: #f5f5f5;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #666;
  transition: all 0.2s;
}

.icon-btn:hover {
  background: #e0e0e0;
  color: #333;
}
</style>
