// 简单分词（中文按字符，英文按单词）
export function tokenize(text: string): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim()
  const words: string[] = []
  let current = ''
  for (const char of cleaned) {
    if (/[\u4e00-\u9fa5]/.test(char)) {
      if (current) {
        words.push(current.toLowerCase())
        current = ''
      }
      words.push(char)
    } else if (/[a-zA-Z0-9]/.test(char)) {
      current += char
    } else {
      if (current) {
        words.push(current.toLowerCase())
        current = ''
      }
    }
  }
  if (current) words.push(current.toLowerCase())
  return words.filter(Boolean)
}

// 提取关键词（简单实现：去停用词后取前N个）
const STOP_WORDS = new Set(['的', '了', '是', '在', '有', '和', '与', '或', '一个', '这', '那', 'to', 'the', 'a', 'an', 'is', 'are'])
export function extractKeywords(text: string, maxCount = 10): string[] {
  const tokens = tokenize(text)
  const filtered = tokens.filter((t) => t.length > 1 && !STOP_WORDS.has(t))
  const seen = new Set<string>()
  const result: string[] = []
  for (const t of filtered) {
    if (!seen.has(t) && result.length < maxCount) {
      seen.add(t)
      result.push(t)
    }
  }
  return result
}
