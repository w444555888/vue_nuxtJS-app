<template>
  <div>聊天页面</div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'chat',
  middleware: 'auth'
})

const authStore = useAuthStore()
const chatStore = useChatStore()
const route = useRoute()
const { fetchMessages } = useChatService()
const { joinRoom } = useSocket()

// 当聊天室改变时加载消息
watch(
  () => route.params.id,
  async (newId) => {
    if (newId && chatStore.currentRoom) {
      const roomId = parseInt(newId as string)
      const result = await fetchMessages(roomId)
      
      if (result.success) {
        // 加入 Socket.io 聊天室
        joinRoom(authStore.user.id, roomId)
      }
    }
  },
  { immediate: true }
)
</script>

<style scoped></style>
