<template>
  <div class="chat-container">
    <!-- 左侧面板 -->
    <aside class="sidebar">
      <!-- 使用者資訊 & 體外 -->
      <div class="sidebar-header">
        <div class="user-quick-info">
          <img :src="authStore.user?.avatar || `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${authStore.user?.username}`" 
               class="user-avatar" 
               alt="avatar">
          <div class="user-name">{{ authStore.user?.username }}</div>
        </div>
        <button @click="showUserModal = true" class="btn-icon" title="編輯個人資料">
          <EditOutlined />
        </button>
      </div>

      <!-- 搜索框 -->
      <div class="search-box">
        <input v-model="searchQuery" 
               type="text" 
               placeholder="搜尋聊天室..." 
               class="search-input">
      </div>

      <!-- 建立聊天室按鈕 -->
      <button @click="showCreateRoomModal = true" class="btn-create-room">
        + 建立新群組
      </button>

      <!-- 聊天室列表 -->
      <div class="rooms-list">
        <div v-if="filteredRooms.length === 0" class="empty-state">
          暫無聊天室
        </div>
        <div v-for="room in filteredRooms" 
             :key="room.id" 
             @click="selectRoom(room)"
             :class="['room-item', { active: selectedRoom?.id === room.id }]">
          <div class="room-header">
            <h3 class="room-name">{{ room.name }}</h3>
            <button @click.stop="showRoomMenu(room)" class="btn-menu">⋮</button>
          </div>
          <p class="room-desc">{{ room.description || '無描述' }}</p>
          <span v-if="room.unreadCount > 0" class="badge">{{ room.unreadCount }}</span>
          
          <!-- 房间菜单 -->
          <div v-if="openMenu?.id === room.id" class="room-menu">
            <button @click.stop="inviteFriendsToRoom(room)" class="menu-item">邀請好友</button>
            <button 
              v-if="room.creatorId === authStore.user?.id" 
              @click.stop="editRoomModal.show = true; editRoomModal.room = room" 
              class="menu-item"
            >
              編輯群組
            </button>
            <button 
              v-if="room.creatorId === authStore.user?.id" 
              @click.stop="deleteRoom(room)" 
              class="menu-item delete"
            >
              刪除群組
            </button>
          </div>
        </div>
      </div>
    </aside>

    <!-- 中间面板 -->
    <main class="main-content">
      <div v-if="!selectedRoom" class="welcome-screen">
        <div class="welcome-content">
          <h1>歡迎來到聊天室</h1>
          <p>選擇一個聊天室開始對話</p>
          <button @click="showCreateRoomModal = true" class="btn-primary">
            建立第一個群組
          </button>
        </div>
      </div>
      <ChatRoom 
        v-else 
        :room="selectedRoom"
        :current-user-id="authStore.user?.id || 0"
        @invite="inviteFriendsToRoom(selectedRoom)"
        @message-sent="() => {}"
      />
    </main>

    <!-- 右侧面板 -->
    <aside class="right-panel">
      <!-- Tab切换 -->
      <div class="panel-tabs">
        <button :class="['tab', { active: rightPanelTab === 'profile' }]"
                @click="rightPanelTab = 'profile'">
          個人資料
        </button>
        <button :class="['tab', { active: rightPanelTab === 'friends' }]"
                @click="rightPanelTab = 'friends'">
          好友
        </button>
      </div>

      <!-- 個人資料面板 -->
      <div v-if="rightPanelTab === 'profile'" class="panel-content">
        <div class="profile-info">
          <img :src="authStore.user?.avatar || `https://api.dicebear.com/9.x/pixel-art-neutral/svg?scale=50&seed=${authStore.user?.username}`" 
               class="profile-avatar" 
               alt="avatar">
          <div class="profile-details">
            <div class="detail-item">
              <span class="label">使用者名：</span>
              <span class="value">{{ authStore.user?.username }}</span>
            </div>
            <div class="detail-item">
              <span class="label">郵箱：</span>
              <span class="value">{{ authStore.user?.email }}</span>
            </div>
            <div class="detail-item">
              <span class="label">ID：</span>
              <span class="value">{{ authStore.user?.id }}</span>
            </div>
          </div>
        </div>
        <div class="profile-actions">
          <button @click="showAvatarModal = true" class="btn-secondary">更換頭像</button>
          <button @click="showUserModal = true" class="btn-secondary">編輯</button>
          <button @click="logout" class="btn-danger">登出</button>
        </div>
      </div>

      <!-- 好友面板 -->
      <div v-else-if="rightPanelTab === 'friends'" class="panel-content">
        <div class="friends-section">
          <h3>我的好友 ({{ friends.length }})</h3>
          <div v-if="friends.length === 0" class="empty-state">暫無好友</div>
          <div v-for="friend in friends" :key="friend.id" class="friend-item">
            <span class="friend-name">{{ friend.username }}</span>
            <button @click="removeFriend(friend)" class="btn-remove">✕</button>
          </div>
        </div>

        <div class="friends-section">
          <h3>好友請求 ({{ friendRequests.length }})</h3>
          <div v-if="friendRequests.length === 0" class="empty-state">暫無請求</div>
          <div v-for="request in friendRequests" :key="request.id" class="friend-request">
            <span class="friend-name">{{ request.username }}</span>
            <button @click="acceptFriend(request)" class="btn-accept">✓</button>
            <button @click="rejectFriend(request)" class="btn-reject">✕</button>
          </div>
        </div>

        <div class="add-friend-section">
          <input v-model="newFriendEmail" 
                 type="email" 
                 placeholder="輸入好友郵箱..." 
                 class="input-email">
          <button @click="addFriendByEmail" class="btn-primary">新增好友</button>
        </div>
      </div>
    </aside>

    <!-- 編輯個人資料模態框 -->
    <Modal 
      :show="showUserModal" 
      title="編輯個人資料"
      @update:show="(value) => showUserModal = value"
    >
      <div class="form-group">
        <label>使用者名</label>
        <input v-model="userForm.username" type="text" class="form-input">
      </div>
      <div class="form-group">
        <label>郵箱</label>
        <input v-model="userForm.email" type="email" class="form-input">
      </div>
      <div class="form-group">
        <label>新密碼（留空則不修改）</label>
        <input v-model="userForm.newPassword" type="password" class="form-input">
      </div>
      <template #actions>
        <button @click="saveUserProfile" class="btn-primary">儲存</button>
        <button @click="showUserModal = false" class="btn-secondary">取消</button>
      </template>
    </Modal>

    <!-- 建立新群組模態框 -->
    <Modal 
      :show="showCreateRoomModal" 
      title="建立新群組"
      @update:show="(value) => showCreateRoomModal = value"
    >
      <div class="form-group">
        <label>群組名稱</label>
        <input v-model="roomForm.name" type="text" placeholder="輸入群組名稱" class="form-input">
      </div>
      <div class="form-group">
        <label>群組描述</label>
        <textarea v-model="roomForm.description" placeholder="輸入群組描述" class="form-input"></textarea>
      </div>
      <template #actions>
        <button @click="createRoom" class="btn-primary">建立</button>
        <button @click="showCreateRoomModal = false" class="btn-secondary">取消</button>
      </template>
    </Modal>

    <!-- 邀請好友模態框 -->
    <Modal 
      :show="showInviteModal" 
      :title="`邀請好友到 ${inviteTargetRoom?.name}`"
      @update:show="(value) => showInviteModal = value"
    >
      <p style="color: #999; font-size: 12px; margin: -12px 0 16px 0">已選擇 {{ selectedFriendsForInvite.length }} 位好友</p>
      <div v-if="invitableFriends.length === 0" class="empty-state">{{ friends.length === 0 ? '暫無好友' : '所有好友已在此群組' }}</div>
      <div v-else class="friends-invite-list">
        <label v-for="friend in invitableFriends" :key="friend.id" class="friend-checkbox">
          <input type="checkbox" :value="friend.id" v-model="selectedFriendsForInvite">
          <span>{{ friend.username }}</span>
        </label>
      </div>
      <template #actions>
        <button @click="sendInvites" class="btn-primary">邀請 ({{ selectedFriendsForInvite.length }})</button>
        <button @click="showInviteModal = false" class="btn-secondary">取消</button>
      </template>
    </Modal>

    <!-- 編輯群組模態框 -->
    <Modal 
      :show="editRoomModal.show" 
      title="編輯群組"
      @update:show="(value) => editRoomModal.show = value"
    >
      <div v-if="editRoomModal.room" class="edit-room-form">
        <div class="form-group">
          <label>群組名稱</label>
          <input v-model="editRoomModal.room.name" type="text" class="form-input">
        </div>
        <div class="form-group">
          <label>群組描述</label>
          <textarea v-model="editRoomModal.room.description" class="form-input"></textarea>
        </div>
      </div>
      <template #actions>
        <button @click="saveRoomEdit" class="btn-primary">儲存</button>
        <button @click="editRoomModal.show = false" class="btn-secondary">取消</button>
      </template>
    </Modal>

    <!-- 確認對話框 -->
    <ConfirmModal 
      :show="showConfirmModal"
      :title="confirmTitle"
      :message="confirmMessage"
      type="danger"
      @confirm="confirmAction"
      @cancel="showConfirmModal = false"
    />

    <!-- 頭像選擇模態框 -->
    <AvatarPickerModal 
      :show="showAvatarModal" 
      :current-username="authStore.user?.username || ''"
      @update:show="(value) => showAvatarModal = value"
      @avatar-updated="() => {}"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { EditOutlined } from '@antdv-next/icons'
import ChatRoom from '~/components/ChatRoom.vue'
import Modal from '~/components/Modal.vue'
import ConfirmModal from '~/components/ConfirmModal.vue'
import AvatarPickerModal from '~/components/AvatarPickerModal.vue'

definePageMeta({
  layout: 'chat',
  middleware: 'auth'
})

const router = useRouter()
const authStore = useAuthStore()
const chatService = useChatService()
const friendService = useFriendService()
const profileService = useProfileService()


const selectedRoom = ref<any>(null)
const searchQuery = ref('')
const rightPanelTab = ref<'profile' | 'friends'>('profile')
const openMenu = ref<any>(null)
const showUserModal = ref(false)
const showAvatarModal = ref(false)
const showCreateRoomModal = ref(false)
const showInviteModal = ref(false)
const showConfirmModal = ref(false)
const editRoomModal = ref({
  show: false,
  room: null as any
})
const confirmAction = ref<() => Promise<void> | void>(() => {})
const confirmTitle = ref('')
const confirmMessage = ref('')

// 表單資料
const userForm = ref({
  username: authStore.user?.username || '',
  email: authStore.user?.email || '',
  newPassword: ''
})

const roomForm = ref({
  name: '',
  description: ''
})

// 好友資料
const friends = ref<any[]>([])
const friendRequests = ref<any[]>([])
const newFriendEmail = ref('')
const selectedFriendsForInvite = ref<number[]>([])
const inviteTargetRoom = ref<any>(null)
const roomMemberIds = ref<number[]>([])

const chatStore = useChatStore()
const filteredRooms = computed(() => {
  if (!searchQuery.value) return chatStore.rooms
  return chatStore.rooms.filter((room: any) => 
    room.name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// 可邀請的好友（排除已在房間內的成員）
const invitableFriends = computed(() => {
  return friends.value.filter(friend => !roomMemberIds.value.includes(friend.id))
})


const selectRoom = (room: any) => {
  selectedRoom.value = room
  chatStore.setCurrentRoom(room)
  openMenu.value = null
}

const showRoomMenu = (room: any) => {
  openMenu.value = openMenu.value?.id === room.id ? null : room
}

const createRoom = async () => {
  if (!roomForm.value.name.trim()) {
    message.error('請輸入群組名稱')
    return
  }
  
  const result = await chatService.createRoom(roomForm.value.name, roomForm.value.description)
  if (result.success) {
    showCreateRoomModal.value = false
    roomForm.value = { name: '', description: '' }
    // 刷新聊天室列表
    await chatService.fetchRooms()
    message.success(result.message || '群組建立成功！')
  } else {
    message.error(result.message || '建立失敗')
  }
}

const deleteRoom = (room: any) => {
  confirmTitle.value = '刪除群組'
  confirmMessage.value = `確定要刪除群組 "${room.name}" 嗎？`
  confirmAction.value = async () => {
    const result = await chatService.deleteRoom(room.id)
    if (result.success) {
      message.success(result.message || '群組已刪除')
      // 刷新聊天室列表
      await chatService.fetchRooms()
    } else {
      message.error(result.message || '删除失败')
    }
    openMenu.value = null
    showConfirmModal.value = false
  }
  showConfirmModal.value = true
}

const saveRoomEdit = async () => {
  if (!editRoomModal.value.room?.name?.trim()) {
    message.error('群組名稱不能為空')
    return
  }
  
  const result = await chatService.updateRoom(
    editRoomModal.value.room.id,
    {
      name: editRoomModal.value.room.name,
      description: editRoomModal.value.room.description
    }
  )
  
  if (result.success) {
    message.success('群組已更新')
    editRoomModal.value.show = false
    editRoomModal.value.room = null
    // 刷新聊天室列表
    await chatService.fetchRooms()
  } else {
    message.error(result.message || '更新失敗')
  }
}

const inviteFriendsToRoom = (room: any) => {
  inviteTargetRoom.value = room
  selectedFriendsForInvite.value = [] // 重置選擇
  // 提取房間成員 ID
  roomMemberIds.value = room.members?.map((m: any) => m.id) || []
  showInviteModal.value = true
  openMenu.value = null
}

const sendInvites = async () => {
  if (selectedFriendsForInvite.value.length === 0) {
    message.error('請選擇至少一個好友')
    return
  }
  const result = await chatService.inviteFriendsToRoom(
    inviteTargetRoom.value.id,
    selectedFriendsForInvite.value
  )
  if (result.success) {
    message.success(result.message || `已邀請 ${selectedFriendsForInvite.value.length} 個好友`)
    showInviteModal.value = false
    selectedFriendsForInvite.value = [] // 關閉後重置
  } else {
    message.error(result.message || '邀请失败')
  }
}

const saveUserProfile = async () => {
  const result = await profileService.updateProfile({
    username: userForm.value.username,
    email: userForm.value.email,
    newPassword: userForm.value.newPassword || undefined
  })
  if (result.success) {
    message.success(result.message || '資料更新成功！')
    showUserModal.value = false
    userForm.value.newPassword = ''
  } else {
    message.error(result.message || '更新失败')
  }
}

const addFriendByEmail = async () => {
  if (!newFriendEmail.value.trim()) {
    message.error('請輸入好友郵箱')
    return
  }
  const result = await friendService.sendFriendRequest(newFriendEmail.value)
  if (result.success) {
    message.success(result.message || '好友請求已發送！')
    newFriendEmail.value = ''
  } else {
    message.error(result.message || '发送请求失败')
  }
}

const acceptFriend = async (request: any) => {
  const result = await friendService.acceptFriendRequest(request.id)
  if (result.success) {
    message.success(result.message || '已接受好友請求')
    // 刷新好友列表
    await loadFriends()
    // 刷新待处理请求
    await loadPendingRequests()
  } else {
    message.error(result.message || '操作失败')
  }
}

const rejectFriend = async (request: any) => {
  const result = await friendService.rejectFriendRequest(request.id)
  if (result.success) {
    message.success(result.message || '已拒绝好友请求')
    // 刷新待处理请求
    await loadPendingRequests()
  } else {
    message.error(result.message || '操作失败')
  }
}

const removeFriend = (friend: any) => {
  confirmTitle.value = '刪除好友'
  confirmMessage.value = `確定要刪除好友 "${friend.username}" 嗎？`
  confirmAction.value = async () => {
    const result = await friendService.removeFriend(friend.id)
    if (result.success) {
      message.success(result.message || '已刪除好友')
      // 刷新好友列表
      await loadFriends()
    } else {
      message.error(result.message || '删除失败')
    }
    showConfirmModal.value = false
  }
  showConfirmModal.value = true
}

const logout = async () => {
  const authService = useAuthService()
  authService.logout()
}

// 加载好友列表
const loadFriends = async () => {
  const result = await friendService.fetchFriends()
  if (result.success) {
    friends.value = result.data
  }
}

// 加载待处理的好友请求
const loadPendingRequests = async () => {
  const result = await friendService.fetchPendingRequests()
  if (result.success) {
    friendRequests.value = result.data.map((req: any) => ({
      id: req.id,
      username: req.sender.username,
      email: req.sender.email,
      avatar: req.sender.avatar
    }))
  }
}

// 生命周期
onMounted(async () => {
  // 獲取聊天室列表
  const rooms = await chatService.fetchRooms()
  if (rooms.success && rooms.data?.length > 0) {
    selectedRoom.value = rooms.data[0]
    chatStore.setCurrentRoom(rooms.data[0])
  }
  
  // 獲取好友列表
  await loadFriends()
  
  // 獲取待處理的好友請求
  await loadPendingRequests()
})
</script>

<style scoped lang="scss">
.chat-container {
  display: grid;
  grid-template-columns: 280px 1fr 320px;
  height: 100vh;
  gap: 0;
  background: #f5f7fa;

  @media (max-width: 1400px) {
    grid-template-columns: 240px 1fr 280px;
  }

  @media (max-width: 1024px) {
    grid-template-columns: 200px 1fr 0px;
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
}

/* 左侧 */
.sidebar {
  background: white;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 1px 0 3px rgba(0, 0, 0, 0.05);

  @media (max-width: 768px) {
    display: none;
  }
}

.sidebar-header {
  padding: 20px 16px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fafbfc;
}

.user-quick-info {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.user-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  flex-shrink: 0;
}

.user-name {
  font-weight: 600;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 14px;
}

.btn-icon {
  width: 36px;
  height: 36px;
  border: none;
  background: #f0f0f0;
  border-radius: 6px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  color: #666;

  &:hover {
    background: #e8e8e8;
    color: #333;
  }
}

.search-box {
  padding: 12px 16px;
  border-bottom: 1px solid #e8e8e8;
  background: #fafbfc;
}

.search-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }
}

.btn-create-room {
  margin: 12px 16px;
  padding: 10px 16px;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.3);
  }
}

.rooms-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 3px;

    &:hover {
      background: #999;
    }
  }
}

.room-item {
  padding: 12px;
  margin-bottom: 8px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;

  &:hover {
    background: #f0f2f5;
    border-color: #d9d9d9;
  }

  &.active {
    background: linear-gradient(135deg, #667eea10 0%, #a894c710 100%);
    border-left: 3px solid #667eea;
    border-color: #667eea;
  }
}

.room-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  gap: 8px;
}

.room-name {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.btn-menu {
  background: none;
  border: none;
  color: #999;
  cursor: pointer;
  font-size: 16px;
  padding: 4px 8px;
  flex-shrink: 0;

  &:hover {
    color: #333;
  }
}

.room-desc {
  margin: 0;
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.badge {
  display: inline-block;
  background: linear-gradient(135deg, #f82525 0%, #ff8787 100%);
  color: white;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 10px;
  margin-top: 6px;
  font-weight: 600;
}

.room-menu {
  position: absolute;
  top: 8px;
  right: 8px;
  background: white;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.12);
  z-index: 10;
  min-width: 120px;
}

.menu-item {
  display: block;
  width: 100%;
  padding: 8px 16px;
  background: none;
  border: none;
  text-align: left;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    background: #f5f5f5;
  }

  &.delete {
    color: #f82525;
  }
}

.empty-state {
  text-align: center;
  padding: 24px 16px;
  color: #999;
  font-size: 13px;
  background: linear-gradient(135deg, #f5f7fa 0%, #fafbfc 100%);
  border: 1px dashed #d5dff0;
  border-radius: 8px;
  margin: 8px 0;
}

/* 中间内容区域 */
.main-content {
  background: white;
  display: flex;
  align-items: stretch;
  justify-content: flex-start;
  position: relative;
  flex-direction: column;
  border-left: 1px solid #e8e8e8;
  border-right: 1px solid #e8e8e8;
  overflow: hidden;
}

.welcome-screen {
  text-align: center;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
}

.welcome-content h1 {
  font-size: 32px;
  margin-bottom: 12px;
  color: #333;
}

.welcome-content p {
  font-size: 16px;
  margin-bottom: 24px;
  color: #666;
}

/* 聊天室頭部 */
.chat-header {
  padding: 16px 24px;
  border-bottom: 1px solid #e8e8e8;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #fafbfc 0%, #f5f7fa 100%);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.header-left {
  flex: 1;
  min-width: 0;
}

.chat-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chat-subtitle {
  margin: 4px 0 0 0;
  font-size: 13px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

.member-count {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  white-space: nowrap;
}

.btn-icon-small {
  width: 32px;
  height: 32px;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  color: white;
  border-radius: 50%;
  cursor: pointer;
  font-weight: 600;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;

  &:hover {
    transform: scale(1.1);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }
}

/* 消息容器 */
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px 24px;
  background: white;
  display: flex;
  flex-direction: column;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 3px;

    &:hover {
      background: #999;
    }
  }
}

.empty-messages {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #999;
  font-size: 14px;
  text-align: center;
}

/* 消息列表 */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.message-item {
  display: flex;
  gap: 12px;
  align-items: flex-end;
  animation: slideIn 0.3s ease;

  &.own {
    flex-direction: row-reverse;
    align-items: flex-end;
  }

  &.own .message-content {
    align-items: flex-end;
  }

  &.own .message-text {
    background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
    color: white;
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

.message-avatar {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  flex-shrink: 0;
  overflow: hidden;
  background: #f0f0f0;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 60%;
  align-items: flex-start;
}

.message-header {
  display: flex;
  gap: 8px;
  align-items: center;
}

.message-author {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.message-time {
  font-size: 12px;
  color: #999;
}

.message-text {
  padding: 10px 14px;
  background: #f0f2f5;
  border-radius: 12px;
  word-break: break-word;
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

/* 聊天輸入框區域 */
.chat-input-area {
  padding: 16px 24px;
  border-top: 1px solid #e8e8e8;
  background: white;
  display: flex;
  gap: 12px;
  align-items: center;
}

.chat-input {
  flex: 1;
  padding: 10px 14px;
  border: 1px solid #d9d9d9;
  border-radius: 8px;
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

.btn-send {
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 600;
  font-size: 14px;
  cursor: pointer;
  transition: all 0.2s;
  white-space: nowrap;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
  }

  &:active {
    transform: translateY(0);
  }
}

/* 右侧面板 */
.right-panel {
  background: white;
  border-left: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: -1px 0 3px rgba(0, 0, 0, 0.05);

  @media (max-width: 1024px) {
    display: none;
  }

  @media (max-width: 768px) {
    display: none;
  }
}

.panel-tabs {
  display: flex;
  border-bottom: 1px solid #eee;
  background: #f9f9f9;

  .tab {
    flex: 1;
    padding: 12px;
    background: none;
    border: none;
    cursor: pointer;
    font-weight: 600;
    color: #666;
    font-size: 13px;
    transition: all 0.2s;

    &.active {
      color: #667eea;
      border-bottom: 2px solid #667eea;
      margin-bottom: -1px;
    }

    &:hover:not(.active) {
      color: #333;
    }
  }
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  background: white;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 3px;

    &:hover {
      background: #999;
    }
  }
}

.profile-info {
  text-align: center;
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #fafbfc 100%);
  border: 1px solid #eef2f8;
  border-radius: 10px;
}

.profile-avatar {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  margin-bottom: 12px;
  border: 3px solid white;
  box-shadow: 0 2px 8px rgba(102, 126, 234, 0.2);
}

.profile-details {
  margin-bottom: 16px;
}

.profile-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: center;

  .btn-secondary,
  .btn-danger {
    margin-right: 0;
    margin-bottom: 0;
  }
}

.detail-item {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  margin-bottom: 12px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e8e8e8;

  .label {
    color: #666;
    font-weight: 500;
  }

  .value {
    color: #333;
    word-break: break-all;
    font-weight: 500;
  }

  &:last-child {
    border-bottom: none;
    margin-bottom: 0;
    padding-bottom: 0;
  }
}

.friends-section {
  margin-bottom: 24px;
  padding: 16px;
  background: linear-gradient(135deg, #f5f7fa 0%, #fafbfc 100%);
  border-radius: 10px;
  border: 1px solid #eef2f8;

  &:last-child {
    margin-bottom: 0;
  }

  h3 {
    margin: 0 0 14px 0;
    font-size: 13px;
    color: #667eea;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    display: flex;
    align-items: center;
    gap: 6px;

    &::before {
      content: '';
      width: 3px;
      height: 16px;
      background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
      border-radius: 2px;
    }
  }
}

.friend-item,
.friend-request {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 14px;
  background: white;
  border: 1px solid #e8eef8;
  border-radius: 8px;
  margin-bottom: 10px;
  font-size: 13px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 3px;
    background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
    transform: scaleY(0);
    transition: transform 0.3s ease;
  }

  &:hover {
    background: #f8f9fc;
    border-color: #d5dff0;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
    transform: translateX(4px);

    &::before {
      transform: scaleY(1);
    }
  }

  &:last-child {
    margin-bottom: 0;
  }
}

.friend-request {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 8px;
  align-items: center;
}

.friend-name {
  color: #333;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.btn-remove,
.btn-accept,
.btn-reject {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 16px;
  padding: 6px 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s;
  min-width: 32px;
  height: 32px;
}

.btn-remove,
.btn-reject {
  color: #f82525;
  background: rgba(248, 37, 37, 0.08);

  &:hover {
    color: white;
    background: #f82525;
    transform: scale(1.05);
  }
}

.btn-accept {
  color: #28a745;
  background: rgba(40, 167, 69, 0.08);

  &:hover {
    color: white;
    background: #28a745;
    transform: scale(1.05);
  }
}

.add-friend-section {
  margin-top: 16px;
  padding: 12px 14px;
  background: linear-gradient(135deg, #667eea10 0%, #a894c710 100%);
  border: 1px solid #e8eef8;
  border-radius: 10px;
  display: flex;
  gap: 8px;
  align-items: center;
}

.input-email {
  flex: 1;
  min-width: 0;
  padding: 10px 14px;
  border: 1px solid #d5dff0;
  border-radius: 8px;
  font-size: 13px;
  background: white;
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

.add-friend-section .btn-primary {
  flex-shrink: 0;
  padding: 9px 16px;
  white-space: nowrap;
  margin: 0;
}

/* 模態框 - 表單相關樣式 */
.form-group {
  margin-bottom: 16px;

  label {
    display: block;
    margin-bottom: 8px;
    font-size: 13px;
    font-weight: 500;
    color: #333;
  }
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;

  &:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 2px rgba(102, 126, 234, 0.1);
  }
}

textarea.form-input {
  resize: vertical;
  min-height: 80px;
}

.friend-checkbox {
  display: flex;
  align-items: center;
  padding: 12px 14px;
  font-size: 13px;
  margin-bottom: 10px;
  background: white;
  border: 1px solid #e8eef8;
  border-radius: 8px;
  transition: all 0.3s ease;
  cursor: pointer;

  &:hover {
    background: #f8f9fc;
    border-color: #d5dff0;
    box-shadow: 0 2px 8px rgba(102, 126, 234, 0.1);
  }

  input[type="checkbox"] {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    width: 18px;
    height: 18px;
    border: 2px solid #d5dff0;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s ease;
    background: white;
    flex-shrink: 0;
    margin-right: 12px;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      border-color: #667eea;
      background: #f0f3ff;
    }

    &:checked {
      background: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
      border-color: #667eea;
      position: relative;

      &::after {
        content: '✓';
        color: white;
        font-size: 12px;
        font-weight: bold;
        position: absolute;
        display: flex;
        align-items: center;
        justify-content: center;
      }
    }
  }

  label {
    cursor: pointer;
    flex: 1;
    color: #333;
    font-weight: 500;
    user-select: none;
  }
}

.friends-invite-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  max-height: 400px;
  overflow-y: auto;
  padding: 4px;

  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #d9d9d9;
    border-radius: 3px;

    &:hover {
      background: #999;
    }
  }
}

.btn-primary,
.btn-secondary,
.btn-danger {
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
    box-shadow: 0 6px 16px rgba(102, 126, 234, 0.3);
  }
}

.btn-secondary {
  background: #f0f0f0;
  color: #333;

  &:hover {
    background: #e8e8e8;
  }
}

.btn-danger {
  background: #f82525;
  color: white;

  &:hover {
    background: #ff5252;
  }
}
</style>
