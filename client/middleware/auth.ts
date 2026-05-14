import { defineNuxtRouteMiddleware, navigateTo } from 'nuxt/app'
import type { RouteLocationNormalized } from 'vue-router'
import { isClient } from '~/utils/environment'

export default defineNuxtRouteMiddleware((to: RouteLocationNormalized, from: RouteLocationNormalized) => {
  const authStore = useAuthStore()
  
  // 只在客户端初始化認證
  // SSR 環境 localStorage 不可用，會導致錯誤的重定向
  if (isClient()) {
    authStore.initAuth()

    if (!authStore.isAuthenticated && to.path !== '/login') {
      return navigateTo('/login')
    }
    
    if (authStore.isAuthenticated && to.path === '/login') {
      return navigateTo('/chat')
    }
  }
  
})
