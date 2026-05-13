<template>
  <div class="chat-sidebar">
    <!-- 頂部 - 用戶資訊和操作 -->
    <div class="sidebar-header">
      <div class="user-info">
        <img v-if="authStore.user?.avatar" :src="authStore.user.avatar" :alt="authStore.user.username" class="user-avatar" />
        <div v-else class="user-avatar-placeholder">
          {{ authStore.user?.username?.charAt(0).toUpperCase() }}
        </div>
        <span class="username">{{ authStore.user?.username }}</span>
      </div>
      <div class="header-actions">
        <button class="icon-btn" title="建立新訊息室">
          <PlusOutlined />
        </button>
        <button class="icon-btn" @click="handleLogout" title="登出">
          <LogoutOutlined />
        </button>
      </div>
    </div>

    <!-- 搜尋框 -->
    <div class="sidebar-search">
      <input 
        v-model="searchQuery"
        type="text" 
        placeholder="搜尋訊息室..." 
        class="search-input"
      />
    </div>

    <!-- 聊天室列表 -->
    <div class="rooms-list">
      <div 
        v-if="filteredRooms.length === 0" 
        class="empty-state"
      >
        <p>暂無訊息室</p>
      </div>

      <div 
        v-for="room in filteredRooms" 
        :key="room.id"
        :class="['room-item', { active: chatStore.currentRoom?.id === room.id }]"
        @click="selectRoom(room)"
      >
        <div class="room-avatar">
          {{ room.name.charAt(0).toUpperCase() }}
        </div>
        <div class="room-info">
          <div class="room-name">{{ room.name }}</div>
          <div class="room-preview">{{ room.lastMessage || room.description }}</div>
        </div>
        <div v-if="room.unreadCount > 0" class="unread-badge">
          {{ room.unreadCount > 99 ? '99+' : room.unreadCount }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { PlusOutlined, LogoutOutlined } from '@antdv-next/icons'

const authStore = useAuthStore()
const chatStore = useChatStore()
const router = useRouter()
const { logout } = useAuthService()

const searchQuery = ref('')

const filteredRooms = computed(() => {
  if (!searchQuery.value) {
    return chatStore.rooms
  }
  return chatStore.rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

const selectRoom = (room: any) => {
  chatStore.setCurrentRoom(room)
  chatStore.markRoomAsRead(room.id)
  navigateTo(`/chat/${room.id}`)
}

const handleLogout = () => {
  if (confirm('確定要登出嗎？')) {
    logout()
  }
}
</script>

<style scoped lang="css">
.chat-sidebar {
  width: 300px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-right: 1px solid #e5e5e5;
  overflow: hidden;
}

.sidebar-header {
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.user-avatar,
.user-avatar-placeholder {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 18px;
  flex-shrink: 0;
}

.user-avatar {
  object-fit: cover;
}

.username {
  font-weight: 500;
  font-size: 14px;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-actions {
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
  flex-shrink: 0;
}

.icon-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.sidebar-search {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 20px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.search-input:focus {
  border-color: #667eea;
  box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
}

.rooms-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: #999;
  font-size: 14px;
}

.room-item {
  padding: 12px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
  transition: background 0.2s;
  border-left: 3px solid transparent;
}

.room-item:hover {
  background: #f5f5f5;
}

.room-item.active {
  background: #f0f3ff;
  border-left-color: #667eea;
}

.room-avatar {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 20px;
  flex-shrink: 0;
}

.room-info {
  flex: 1;
  min-width: 0;
}

.room-name {
  font-weight: 500;
  font-size: 14px;
  color: #333;
  margin-bottom: 4px;
}

.room-preview {
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.unread-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ff4d4f;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  flex-shrink: 0;
}

/* 滚动条样式 */
.rooms-list::-webkit-scrollbar {
  width: 6px;
}

.rooms-list::-webkit-scrollbar-track {
  background: transparent;
}

.rooms-list::-webkit-scrollbar-thumb {
  background: #ccc;
  border-radius: 3px;
}

.rooms-list::-webkit-scrollbar-thumb:hover {
  background: #999;
}
</style>
