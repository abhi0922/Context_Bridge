import { Message } from '../types'

const AVG_CHARS_PER_TOKEN = 4
const MAX_TOKENS_PER_MESSAGE = 2000

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN)
}

export function truncateMessages(
  messages: Message[],
  maxTotalTokens: number
): Message[] {
  const totalChars = messages.reduce((sum, m) => sum + m.content.length, 0)
  const estimatedTokens = Math.ceil(totalChars / AVG_CHARS_PER_TOKEN)

  if (estimatedTokens <= maxTotalTokens) return messages

  const truncated: Message[] = []
  let accumulatedTokens = 0

  const halfLimit = maxTotalTokens / 2
  const recentMessages: Message[] = []
  const olderMessages: Message[] = []

  for (let i = messages.length - 1; i >= 0; i--) {
    if (recentMessages.length < 4) {
      recentMessages.unshift(messages[i])
    } else {
      olderMessages.unshift(messages[i])
    }
  }

  for (const msg of olderMessages) {
    const msgTokens = estimateTokens(msg.content)
    if (accumulatedTokens + msgTokens > halfLimit / 2) {
      truncated.push({
        ...msg,
        content: msg.content.slice(0, Math.floor((halfLimit / 2 - accumulatedTokens) * AVG_CHARS_PER_TOKEN)),
      })
      accumulatedTokens += halfLimit / 2 - accumulatedTokens
      break
    }
    truncated.push(msg)
    accumulatedTokens += msgTokens
  }

  accumulatedTokens = 0
  for (const msg of recentMessages) {
    const msgTokens = estimateTokens(msg.content)
    if (accumulatedTokens + msgTokens > halfLimit) {
      truncated.push({
        ...msg,
        content: msg.content.slice(0, Math.floor((halfLimit - accumulatedTokens) * AVG_CHARS_PER_TOKEN)),
      })
      break
    }
    truncated.push(msg)
    accumulatedTokens += msgTokens
  }

  return truncated
}

export function truncateContent(content: string, maxTokens: number): string {
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN
  if (content.length <= maxChars) return content
  return content.slice(0, maxChars) + '\n\n[Content truncated...]'
}

export function formatTokenCount(tokenCount: number): string {
  if (tokenCount >= 1000) {
    return `${(tokenCount / 1000).toFixed(1)}k`
  }
  return `${tokenCount}`
}

export function getCompressionRatio(original: number, compressed: number): number {
  if (original === 0) return 0
  return Math.round((1 - compressed / original) * 100)
}
