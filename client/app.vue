<template>
  <div>
    <NuxtPage />
  </div>
</template>

<script setup lang="ts">
// 全局 meta 標籤設定
useHead({
  titleTemplate: (titleChunk) => {
    return titleChunk ? `${titleChunk} - 聊天室` : '聊天室'
  },
  htmlAttrs: {
    lang: 'zh-TW'
  }
})
</script>

<style lang="scss">
// 主題色變量
$primary-color: #667eea;
$secondary-color: #a894c7;
$gradient-primary: linear-gradient(135deg, #667eea 0%, #a894c7 100%);
$duration: 0.4s;
$easing: ease-in-out; 

// 淡入淡出基礎
.fade-enter-active,
.fade-leave-active {
  transition: all $duration $easing;
}

.fade-enter-from {
  opacity: 0;
  filter: blur(4px);
}

.fade-leave-to {
  opacity: 0;
  filter: blur(2px);
}

.fade-enter-from {
  opacity: 0;
  transform: scale(0.98);
  filter: blur(4px);
}

.fade-leave-to {
  opacity: 0;
  transform: scale(1.02);
  filter: blur(2px);
}
</style>
