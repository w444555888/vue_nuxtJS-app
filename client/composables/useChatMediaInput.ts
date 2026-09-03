import { onUnmounted, ref, type Ref } from 'vue'

type MediaType = 'image' | 'video'

interface ChatMediaInputOptions {
  mediaInputRef: Ref<HTMLInputElement | null>
  maxImageBytes: number
  maxVideoBytes: number
  onError: (message: string) => void
}

export const useChatMediaInput = (options: ChatMediaInputOptions) => {
  const { mediaInputRef } = options
  const previewMedia = ref<string | null>(null)
  const previewType = ref<MediaType | null>(null)
  const selectedFile = ref<File | null>(null)

  // 釋放預覽的 Blob URL
  const revokeBlobPreview = () => {
    if (previewMedia.value?.startsWith('blob:')) {
      URL.revokeObjectURL(previewMedia.value)
    }
  }

  const clearImagePreview = () => {
    revokeBlobPreview()
    previewMedia.value = null
    previewType.value = null
    selectedFile.value = null

    if (mediaInputRef.value) {
      mediaInputRef.value.value = ''
    }
  }

  const openMediaPicker = () => {
    mediaInputRef.value?.click()
  }

  const onMediaInputChange = (event: Event) => {
    const input = event.target as HTMLInputElement
    const nativeFile = input.files?.[0]

    if (!nativeFile) {
      clearImagePreview()
      return
    }

    const isImage = nativeFile.type.startsWith('image/')
    const isVideo = nativeFile.type.startsWith('video/')

    if (!isImage && !isVideo) {
      options.onError('請選擇圖片或影片文件')
      input.value = ''
      return
    }

    const maxSize = isVideo ? options.maxVideoBytes : options.maxImageBytes
    if (nativeFile.size > maxSize) {
      options.onError(isVideo ? '影片大小不能超過 50MB' : '圖片大小不能超過 10MB')
      input.value = ''
      return
    }

    revokeBlobPreview()
    selectedFile.value = nativeFile
    previewType.value = isVideo ? 'video' : 'image'
    previewMedia.value = URL.createObjectURL(nativeFile)
  }

  onUnmounted(() => {
    revokeBlobPreview()
  })

  return {
    mediaInputRef,
    previewMedia,
    previewType,
    selectedFile,
    openMediaPicker,
    onMediaInputChange,
    clearImagePreview
  }
}
