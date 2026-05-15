/**
 * 全局錯誤攔截
 */

export default defineNuxtPlugin((nuxtApp) => {
  // 1. Vue 錯誤處理
  nuxtApp.vueApp.config.errorHandler = (error, instance, info) => {
    console.error('Vue Error:', {
      error,
      component: instance?.$options.name,
      info,
      timestamp: new Date().toISOString()
    })
    
  }

  // 2. Vue 錯誤鉤子
  nuxtApp.hook('vue:error', (error, instance, info) => {
    console.error('Vue Hook Error:', error, info)
  })

  // 3. 啟動錯誤處理
  nuxtApp.hook('app:error', (error) => {
    console.error('App Error:', error)
  })

  // 4. JS 區塊加載錯誤
  if (import.meta.client) {
    nuxtApp.hook('app:chunkError', ({ error }) => {
      console.error('Chunk Load Error:', error)  
      setTimeout(() => {
        window.location.reload()
      }, 1000)
    })
  }
})
