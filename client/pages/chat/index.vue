<template>
  <div>首页 - 聊天室</div>
</template>

<script setup lang="ts">
definePageMeta({
  layout: 'chat',
  middleware: 'auth'
})

const router = useRouter()
const chatStore = useChatStore()

// 默认进入第一个聊天室
onMounted(() => {
  if (chatStore.rooms.length > 0) {
    router.push(`/chat/${chatStore.rooms[0].id}`)
  }
})
</script>

<style scoped></style>
