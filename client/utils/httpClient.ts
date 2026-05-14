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

// axios 實例
const createHttpClient = (): AxiosInstance => {
  const config = useRuntimeConfig()
  const authStore = useAuthStore()
  const router = useRouter()

  const apiBase = config.public.apiBase || 'http://localhost:3001'

  const instance = axios.create({
    baseURL: apiBase,
    headers: {
      'Content-Type': 'application/json'
    }
  })

  // 請求搶截器 - 新增 Authorization token
  instance.interceptors.request.use((config: any) => {
    if (authStore.token) {
      config.headers.Authorization = `Bearer ${authStore.token}`
    }
    return config
  })

  // 攔截器
  instance.interceptors.response.use(
    (response: any) => {
      return response  
    },
    (error: AxiosError) => {
      // 統一錯誤格式
      const errorResponse: ApiResponse = {
        success: false,
        code: error.response?.status || 500,
        message: error.response?.statusText || '請求失敗',
        data: null
      }

      if (error.response?.status === 401) {
        // Token 過期
        errorResponse.message = 'Token 已過期，請重新登入'
        authStore.clearAuth()
        router.push('/login')
      } else if (error.response?.data) {
        const errorData = error.response.data as any
        errorResponse.message = errorData.message || '請求失敗'
      }

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
