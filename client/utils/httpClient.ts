import axios from 'axios'
import type { AxiosInstance, AxiosRequestConfig, AxiosError } from 'axios'

/**
 * 統一的響應格式 (前後端一致)
 * success: 是否成功
 * code: HTTP 狀態碼
 * message: 返回消息
 * data: 返回數據 (失敗時為 null)
 * error: 錯誤詳情 (可選)
 */
export interface ApiResponse<T = any> {
  success: boolean
  code: number
  message: string
  data?: T | null
  error?: string
}

// 控制 token 刷新進行中，防止多個請求同時觸發刷新
let isRefreshing = false
let failedQueue: any[] = []

/**
 * 處理刷新 token 隊列
 * @param error 錯誤信息
 * @param token 新的 access token
 */
const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error)
    } else {
      prom.resolve(token)
    }
  })
  
  isRefreshing = false
  failedQueue = []
}

// axios 實例
const createHttpClient = (): AxiosInstance => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  const router = useRouter()

  const apiBase = config.public.apiBase || 'http://127.0.0.1:3001'

  const instance = axios.create({
    baseURL: apiBase,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  // 請求搶截器 - 新增 Authorization token
  instance.interceptors.request.use((config: any) => {
    // FormData 讓瀏覽器自動帶 boundary，避免被 application/json 破壞
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers) {
        delete config.headers['Content-Type']
        delete config.headers['content-type']
      }
    }

    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  })

  // 攔截器 - 統一錯誤處理 + Token 自動刷新
  instance.interceptors.response.use(
    (response: any) => {
      return response  
    },
    (error: AxiosError) => {
      const originalRequest: any = error.config
      const statusCode = error.response?.status || 500
      const errorData = error.response?.data as any
      const errorResponse: ApiResponse = {
        success: false,
        code: statusCode,
        message: errorData?.message || error.response?.statusText || '請求失敗',
        data: null
      }

      // 401 未授權 - 嘗試使用 refresh token 更新 access token
      if (statusCode === 401 && !originalRequest._retry) {
        // 避免對 /refresh 和 /logout 端點重試
        if (originalRequest.url?.includes('/auth/refresh') || originalRequest.url?.includes('/auth/logout')) {
          authStore.clearAuth()
          router.push('/login')
          return Promise.reject(errorResponse)
        }

        // 如果正在刷新 token，將當前請求加入隊列等待刷新完成
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject })
          }).then(token => {
            if (token) {
              originalRequest.headers.Authorization = `Bearer ${token}`
              return instance(originalRequest)
            }
          })
        }

        originalRequest._retry = true
        isRefreshing = true

        // 發送刷新 token 請求
        return new Promise((resolve, reject) => {
          instance.post('/api/auth/refresh', {
            refreshToken: authStore.refreshToken
          })
            .then(response => {
              const { data } = response
              if (data && data.data) {
                const { accessToken, refreshToken } = data.data
                
                // 更新 store 中的 token
                authStore.updateAccessToken(accessToken)
                authStore.updateRefreshToken(refreshToken)
                
                // 用新 token 重試原請求
                originalRequest.headers.Authorization = `Bearer ${accessToken}`
                processQueue(null, accessToken)
                resolve(instance(originalRequest))
              } else {
                throw new Error('Token refresh failed')
              }
            })
            .catch(err => {
              // 刷新失敗，清除認證並跳轉登入
              authStore.clearAuth()
              router.push('/login')
              processQueue(err, null)
              reject(err)
            })
        })
      }

      // 403 禁止訪問 
      if (statusCode === 403) {
        console.error('403 Forbidden:', errorResponse.message)
        throw createError({
          status: 403,
          statusText: 'Forbidden',
          message: errorResponse.message || '您無權訪問此資源',
          fatal: true
        })
      }

      // 404 資源不存在 - 跳回首頁
      if (statusCode === 404) {
        console.warn('404 Not Found:', errorResponse.message)
        router.push('/')
        return Promise.reject(errorResponse)
      }

      // 5xx 服務器錯誤 
      if (statusCode >= 500) {
        console.error('5xx Server Error:', errorResponse.message)
        throw createError({
          status: statusCode,
          statusText: 'Server Error',
          message: errorResponse.message || '服務器發生錯誤，請稍後再試',
          fatal: true
        })
      }

      // 其他錯誤只記錄警告
      console.warn('API Error:', errorResponse.message)
      return Promise.reject(errorResponse)
    }
  )

  return instance
}

// 創建全局 http 客戶端實例
let httpClient: AxiosInstance | null = null

export const useHttpClient = () => {
  if (!httpClient) {
    httpClient = createHttpClient()
  }

  return {
    // GET 
    get: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
      try {
        const response = await httpClient!.get<ApiResponse<T>>(url, config)
        return response.data
      } catch (error) {
        return error as ApiResponse<T>
      }
    },

    // POST 
    post: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
      try {
        const response = await httpClient!.post<ApiResponse<T>>(url, data, config)
        return response.data
      } catch (error) {
        return error as ApiResponse<T>
      }
    },

    // PUT 
    put: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
      try {
        const response = await httpClient!.put<ApiResponse<T>>(url, data, config)
        return response.data
      } catch (error) {
        return error as ApiResponse<T>
      }
    },

    // PATCH 
    patch: async <T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
      try {
        const response = await httpClient!.patch<ApiResponse<T>>(url, data, config)
        return response.data
      } catch (error) {
        return error as ApiResponse<T>
      }
    },

    // DELETE 
    delete: async <T = any>(url: string, config?: AxiosRequestConfig): Promise<ApiResponse<T>> => {
      try {
        const response = await httpClient!.delete<ApiResponse<T>>(url, config)
        return response.data
      } catch (error) {
        return error as ApiResponse<T>
      }
    },

    // 原始 axios 實例
    axios: httpClient
  }
}
