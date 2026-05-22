import type { LLMConfig } from '@/types'

export const STORAGE_KEY = 'levitate_llm_config'

export const DEFAULT_CONFIG: LLMConfig = {
  provider: 'custom',
  baseUrl: 'https://api.deepseek.com/v1',
  apiKey: '',
  chatModel: 'deepseek-chat',
  embedModel: 'nomic-embed-text',
  timeout: 60000
}

export async function getLLMConfig(): Promise<LLMConfig> {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEY)
    const stored = result[STORAGE_KEY]
    if (stored) {
      return { ...DEFAULT_CONFIG, ...stored }
    }
  } catch {
    // not in extension context
  }
  return { ...DEFAULT_CONFIG }
}

export async function setLLMConfig(config: Partial<LLMConfig>): Promise<void> {
  const current = await getLLMConfig()
  const merged = { ...current, ...config }
  await chrome.storage.local.set({ [STORAGE_KEY]: merged })
}
