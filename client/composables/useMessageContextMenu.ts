import { onUnmounted, shallowRef } from 'vue'

interface ContextMenuState<T> {
  show: boolean
  x: number
  y: number
  message: T | null
}

export const useMessageContextMenu = <T>() => {
  const replyTarget = shallowRef<T | null>(null)
  const contextMenu = shallowRef<ContextMenuState<T>>({
    show: false,
    x: 0,
    y: 0,
    message: null
  })
  let addClickListenerTimer: ReturnType<typeof setTimeout> | null = null

  const hideContextMenu = () => {
    if (addClickListenerTimer) {
      clearTimeout(addClickListenerTimer)
      addClickListenerTimer = null
    }

    contextMenu.value = {
      ...contextMenu.value,
      show: false
    }
    document.removeEventListener('click', hideContextMenu)
  }

  const showContextMenu = (event: MouseEvent, message: T) => {
    contextMenu.value = {
      show: true,
      x: event.clientX,
      y: event.clientY,
      message
    }

    addClickListenerTimer = setTimeout(() => {
      document.addEventListener('click', hideContextMenu)
      addClickListenerTimer = null
    }, 0)
  }

  const startReply = () => {
    if (!contextMenu.value.message) {
      return
    }

    replyTarget.value = contextMenu.value.message
    hideContextMenu()
  }

  const cancelReply = () => {
    replyTarget.value = null
  }

  onUnmounted(hideContextMenu)

  return {
    contextMenu,
    replyTarget,
    showContextMenu,
    hideContextMenu,
    startReply,
    cancelReply
  }
}
