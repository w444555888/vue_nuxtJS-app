export default defineRouteMiddleware((to, from) => {
  const authStore = useAuthStore()

  // 初始化认证状态
  authStore.initAuth()

  // 如果未认证且不在登入页，重定向到登入
  if (!authStore.isAuthenticated && to.path !== '/login') {
    return navigateTo('/login')
  }

  // 如果已认证且在登入页，重定向到聊天
  if (authStore.isAuthenticated && to.path === '/login') {
    return navigateTo('/chat')
  }
})
