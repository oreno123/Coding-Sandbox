/**
 * 网页划线引用栏
 * 用户一划线即显示，取消划线即消失（实时同步，无需点击加入引用）
 */

import { useState, useEffect, useCallback } from 'react'

interface CurrentSelection {
  text: string
  url: string
  title: string
}

export function WebpageHighlightRefsBar() {
  const [selection, setSelection] = useState<CurrentSelection | null>(null)

  const loadSelection = useCallback(async () => {
    try {
      const result = await chrome.storage.session.get('currentSelection')
      const sel = result.currentSelection
      if (sel && typeof sel.text === 'string' && sel.text.trim()) {
        setSelection({
          text: sel.text.trim(),
          url: sel.url || '',
          title: sel.title || sel.url || '',
        })
      } else {
        setSelection(null)
      }
    } catch {
      setSelection(null)
    }
  }, [])

  useEffect(() => {
    loadSelection()

    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'session' && 'currentSelection' in changes) {
        loadSelection()
      }
    }
    chrome.storage.onChanged.addListener(listener)

    const interval = setInterval(loadSelection, 500)
    return () => {
      chrome.storage.onChanged.removeListener(listener)
      clearInterval(interval)
    }
  }, [loadSelection])

  if (!selection) return null

  return (
    <div className="px-3 py-2 border-b border-[var(--border-primary)] bg-[var(--bg-secondary)]/50">
      <span className="text-xs font-medium text-[var(--text-muted)] block mb-1.5">
        网页划线引用
      </span>
      <div className="text-xs p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border-primary)]">
        <p className="text-[var(--text-secondary)] line-clamp-3 break-words">
          &ldquo;{selection.text}&rdquo;
        </p>
        <p className="text-[var(--text-muted)] truncate mt-1" title={selection.url}>
          {selection.title || selection.url}
        </p>
      </div>
    </div>
  )
}
