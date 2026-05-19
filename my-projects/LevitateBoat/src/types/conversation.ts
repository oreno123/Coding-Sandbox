export interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface Conversation {
  id: string
  messages: ConversationMessage[]
  memoryIds: string[]
  createdAt: number
  updatedAt: number
}
