import dayjs from 'dayjs'

export const toImageSrc = (imageUrl?: string) => {
  if (!imageUrl) return ''
  return /^https?:\/\//i.test(imageUrl) ? imageUrl : ''
}

export const isVideoUrl = (url?: string) => {
  if (!url) return false
  return /(\.mp4|\.webm|\.mov)(\?|$)/i.test(url) || /\/video\/upload\//i.test(url)
}

export const truncateReplyContent = (content?: string | null, maxLength = 42) => {
  if (!content) return ''

  return content.length > maxLength ? `${content.slice(0, maxLength)}...` : content
}

export const formatMessageTime = (timestamp: string) => {
  return dayjs(timestamp).format('YYYY-MM-DD HH:mm')
}
