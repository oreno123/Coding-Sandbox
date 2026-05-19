

import { useEffect } from 'react'

export const ImageViewer = ({ imageUrl, onClose }: { imageUrl: string | null, onClose: () => void }) => {
  useEffect(() => {
    if (!imageUrl) return

    // 通过 content script 在页面中显示图片查看器
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.sendMessage(
          tabs[0].id,
          { action: 'showImageViewer', imageUrl },
          () => {
            // 关闭侧边栏的查看器
            onClose()
          }
        )
      }
    })
  }, [imageUrl, onClose])

  // 不在侧边栏渲染任何内容
  return null
}