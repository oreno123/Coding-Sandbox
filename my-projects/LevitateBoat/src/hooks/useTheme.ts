/**
 * Vue composable for theme management
 */

import { ref, onMounted, onUnmounted } from 'vue'
import type { Theme } from '@/styles/theme'
import { setTheme, toggleTheme as toggleThemeFn, initializeTheme } from '@/styles/theme'

export function useTheme() {
  const theme = ref<Theme>('light')

  const handleStorageChange = (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes.theme?.newValue) {
      theme.value = changes.theme.newValue as Theme
      document.documentElement.dataset.theme = changes.theme.newValue
    }
  }

  onMounted(async () => {
    const initial = await initializeTheme()
    theme.value = initial
    try {
      chrome.storage.onChanged.addListener(handleStorageChange)
    } catch {
      /* not in extension context */
    }
  })

  onUnmounted(() => {
    try {
      chrome.storage.onChanged.removeListener(handleStorageChange)
    } catch {
      /* not in extension context */
    }
  })

  function setThemeValue(newTheme: Theme) {
    setTheme(newTheme)
    theme.value = newTheme
  }

  function toggleTheme() {
    const next = toggleThemeFn()
    theme.value = next
  }

  return { theme, setTheme: setThemeValue, toggleTheme, isDark: () => theme.value === 'dark' }
}
