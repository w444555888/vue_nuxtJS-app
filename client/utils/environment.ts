/**
 * 環境檢測工具函數
 * 安全用於 SSR 和客户端環境
 * 符合 Nuxt 3/4 官方最佳實踐
 */

/**
 * 檢查代碼是否在瀏覽器/客户端環境中運行
 * Nuxt 官方推薦方式：https://nuxt.com/docs/guide/concepts/ssr
 * 
 * 為什麼用 typeof window？
 * - 最簡單、最通用的方式
 * - 可以在任何地方使用（store、composables、plugins 等）
 * - 沒有 composable context 的限制
 * - 性能最優（直接檢查，無函數開銷）
 */
export const isClient = (): boolean => {
  return typeof window !== 'undefined'
}

/**
 * 檢查代碼是否在服務器環境中運行（SSR）
 */
export const isServer = (): boolean => {
  return !isClient()
}

/**
 * 檢查 localStorage 是否可用
 * 用於客户端存儲操作
 * 
 * 為什麼需要這個檢查？
 * - SSR 環境沒有 localStorage
 * - 私密瀏覽模式可能無法訪問
 * - 某些環境可能限制存儲訪問
 */
export const hasLocalStorage = (): boolean => {
  if (!isClient()) return false
  
  try {
    // 測試 localStorage 是否真正可訪問
    // 私密模式、某些瀏覽器設置會拋出異常
    const test = '__localStorage_test__'
    localStorage.setItem(test, test)
    localStorage.removeItem(test)
    return true
  } catch (error) {
    console.warn('localStorage 不可用:', error)
    return false
  }
}

/**
 * 安全地從 localStorage 獲取值
 * @param key - 存儲的鍵
 * @returns 存儲的值，或 null（如果不可用）
 */
export const getFromStorage = (key: string): string | null => {
  if (!hasLocalStorage()) return null
  
  try {
    return localStorage.getItem(key)
  } catch (error) {
    console.warn(`無法從 localStorage[${key}] 讀取:`, error)
    return null
  }
}

/**
 * 安全地將值設置到 localStorage
 * @param key - 存儲的鍵
 * @param value - 要存儲的值
 * @returns 是否成功
 */
export const setToStorage = (key: string, value: string): boolean => {
  if (!hasLocalStorage()) return false
  
  try {
    localStorage.setItem(key, value)
    return true
  } catch (error) {
    console.warn(`無法寫入 localStorage[${key}]:`, error)
    return false
  }
}

/**
 * 安全地從 localStorage 移除值
 * @param key - 要移除的鍵
 * @returns 是否成功
 */
export const removeFromStorage = (key: string): boolean => {
  if (!hasLocalStorage()) return false
  
  try {
    localStorage.removeItem(key)
    return true
  } catch (error) {
    console.warn(`無法從 localStorage[${key}] 移除:`, error)
    return false
  }
}
