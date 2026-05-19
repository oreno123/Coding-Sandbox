// LLM 配置
export type LLMProviderType = 'ollama' | 'openai' | 'claude' | 'custom'

export interface LLMConfig {
  provider: LLMProviderType
  baseUrl?: string
  apiKey?: string
  chatModel: string
  embedModel?: string
  timeout?: number
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateOptions {
  stream?: boolean
  maxTokens?: number
  temperature?: number
}

export interface LLMAdapter {
  generate(messages: ChatMessage[], options?: GenerateOptions): Promise<string>
  generateStream(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    options?: GenerateOptions
  ): Promise<void>
  embed?(texts: string[]): Promise<number[][]>
}
