import type { ChatMessage, GenerateOptions, LLMAdapter } from '@/types'
import { getLLMConfig } from './config'

export async function createLLMClient(): Promise<LLMAdapter> {
  const config = await getLLMConfig()
  if (config.provider === 'ollama') {
    return new OllamaProvider(config)
  }
  if (config.provider === 'openai' || config.provider === 'claude' || config.provider === 'custom') {
    return new OpenAICompatibleProvider(config)
  }
  return new OllamaProvider(config)
}

interface ProviderConfig {
  baseUrl?: string
  apiKey?: string
  chatModel: string
  embedModel?: string
  timeout?: number
}

class OllamaProvider implements LLMAdapter {
  constructor(private config: ProviderConfig) {}

  async generate(messages: ChatMessage[], _options?: GenerateOptions): Promise<string> {
    const baseUrl = (this.config.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
    const url = `${baseUrl}/api/chat`
    const body = {
      model: this.config.chatModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false
    }
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), this.config.timeout || 60000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: ctrl.signal
      })
      if (!res.ok) throw new Error(`Ollama API ${res.status}: ${await res.text()}`)
      const json = await res.json()
      return json.message?.content ?? ''
    } finally {
      clearTimeout(t)
    }
  }

  async generateStream(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    _options?: GenerateOptions
  ): Promise<void> {
    const baseUrl = (this.config.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
    const url = `${baseUrl}/api/chat`
    const body = {
      model: this.config.chatModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true
    }
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    if (!res.ok) throw new Error(`Ollama API ${res.status}: ${await res.text()}`)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]' || data === 'null') continue
          try {
            const obj = JSON.parse(data)
            const chunk = obj.message?.content ?? ''
            if (chunk) onChunk(chunk)
          } catch {
            // skip
          }
        }
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const model = this.config.embedModel || 'nomic-embed-text'
    const baseUrl = (this.config.baseUrl || 'http://localhost:11434').replace(/\/$/, '')
    const url = `${baseUrl}/api/embeddings`
    const results: number[][] = []
    for (const text of texts) {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: text })
      })
      if (!res.ok) throw new Error(`Ollama embed ${res.status}: ${await res.text()}`)
      const json = await res.json()
      results.push(json.embedding as number[])
    }
    return results
  }
}

class OpenAICompatibleProvider implements LLMAdapter {
  constructor(private config: ProviderConfig) {}

  async generate(messages: ChatMessage[], _options?: GenerateOptions): Promise<string> {
    const baseUrl = (this.config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`
    const body = {
      model: this.config.chatModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`

    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), this.config.timeout || 60000)
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ctrl.signal
      })
      if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
      const json = await res.json()
      return json.choices?.[0]?.message?.content ?? ''
    } finally {
      clearTimeout(t)
    }
  }

  async generateStream(
    messages: ChatMessage[],
    onChunk: (text: string) => void,
    _options?: GenerateOptions
  ): Promise<void> {
    const baseUrl = (this.config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
    const url = `${baseUrl}/chat/completions`
    const body = {
      model: this.config.chatModel,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: true
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`

    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) })
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`)
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')
    const dec = new TextDecoder()
    let buf = ''
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += dec.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') continue
          try {
            const obj = JSON.parse(data)
            const chunk = obj.choices?.[0]?.delta?.content ?? ''
            if (chunk) onChunk(chunk)
          } catch {
            // skip
          }
        }
      }
    }
  }

  async embed(texts: string[]): Promise<number[][]> {
    const baseUrl = (this.config.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')
    const url = `${baseUrl}/embeddings`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.config.apiKey) headers['Authorization'] = `Bearer ${this.config.apiKey}`

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: this.config.embedModel || 'text-embedding-3-small',
        input: texts
      })
    })
    if (!res.ok) throw new Error(`Embed API ${res.status}: ${await res.text()}`)
    const json = await res.json()
    const items = (json.data as { embedding: number[]; index: number }[]).sort((a, b) => a.index - b.index)
    return items.map((x) => x.embedding)
  }
}
