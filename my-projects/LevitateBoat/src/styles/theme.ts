/**
 * Theme System - Cursor-style theme management
 */

export type Theme = 'light' | 'dark'

export function getCurrentTheme(): Theme {
  return (document.documentElement.dataset.theme as Theme) || 'light'
}

export function setTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
  try {
    chrome.storage.local.set({ theme })
  } catch {
    // Not in extension context
  }
}

export function toggleTheme(): Theme {
  const current = getCurrentTheme()
  const next = current === 'light' ? 'dark' : 'light'
  setTheme(next)
  return next
}

export async function initializeTheme(): Promise<Theme> {
  try {
    const result = await chrome.storage.local.get('theme')
    const theme = (result.theme as Theme) || 'light'
    setTheme(theme)
    return theme
  } catch {
    setTheme('light')
    return 'light'
  }
}
