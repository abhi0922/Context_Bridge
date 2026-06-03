import { DetectionResult, DetectionSignals } from '../../types'

export class GenericDetector {
  private readonly CONFIDENCE_THRESHOLD = 0.6

  detect(): DetectionResult {
    const signals = this.gatherSignals()
    const confidence = this.calculateConfidence(signals)
    return {
      isAIChat: confidence >= this.CONFIDENCE_THRESHOLD,
      confidence,
      signals,
    }
  }

  private gatherSignals(): DetectionSignals {
    return {
      hasTextarea: this.detectTextarea(),
      hasContentEditable: this.detectContentEditable(),
      hasCodeBlocks: this.detectCodeBlocks(),
      hasConversationFlow: this.detectConversationFlow(),
      hasSendButton: this.detectSendButton(),
      hasMarkdownRendering: this.detectMarkdownRendering(),
      hasAIRelatedMetadata: this.detectAIMetadata(),
      hasMessageRoles: this.detectMessageRoles(),
      hasStreamingIndicator: this.detectStreaming(),
    }
  }

  private calculateConfidence(signals: DetectionSignals): number {
    let score = 0
    const weights: Record<keyof DetectionSignals, number> = {
      hasTextarea: 0.15,
      hasContentEditable: 0.15,
      hasCodeBlocks: 0.10,
      hasConversationFlow: 0.20,
      hasSendButton: 0.10,
      hasMarkdownRendering: 0.10,
      hasAIRelatedMetadata: 0.10,
      hasMessageRoles: 0.05,
      hasStreamingIndicator: 0.05,
    }

    for (const [signal, weight] of Object.entries(weights)) {
      if (signals[signal as keyof DetectionSignals]) {
        score += weight
      }
    }
    return Math.min(score, 1.0)
  }

  private detectTextarea(): boolean {
    const textareas = document.querySelectorAll<HTMLTextAreaElement>('textarea')
    for (const ta of textareas) {
      const rect = ta.getBoundingClientRect()
      if (rect.width > 200 && rect.height > 50) return true
    }
    return false
  }

  private detectContentEditable(): boolean {
    const editables = document.querySelectorAll<HTMLElement>('[contenteditable="true"]')
    for (const el of editables) {
      const rect = el.getBoundingClientRect()
      if (rect.width > 200 && rect.height > 50) return true
    }
    return false
  }

  private detectCodeBlocks(): boolean {
    const selectors = [
      'pre code', 'pre', '.highlight', '.code-block',
      '[class*="language-"]', 'code[class*="language-"]',
      'div[class*="code"]', 'pre[class*="code"]',
    ]
    return selectors.some(sel => document.querySelectorAll(sel).length >= 2)
  }

  private detectConversationFlow(): boolean {
    const possibleMessages = document.querySelectorAll(
      '[class*="message"], [class*="chat"], [class*="conversation"], ' +
      '[class*="thread"], [role="log"], [role="list"]'
    )
    if (possibleMessages.length < 2) return false

    let userLike = 0
    let assistantLike = 0

    possibleMessages.forEach(msg => {
      const cls = Array.from(msg.classList).map(c => c.toLowerCase()).join(' ')
      if (cls.includes('user') || cls.includes('human') || cls.includes('self')) userLike++
      if (cls.includes('assistant') || cls.includes('ai') || cls.includes('bot') || cls.includes('model')) assistantLike++
    })

    return userLike >= 1 && assistantLike >= 1
  }

  private detectSendButton(): boolean {
    const selectors = [
      'button[type="submit"]',
      '[aria-label*="send" i]',
      '[aria-label*="submit" i]',
      '[class*="send"]',
      '[class*="submit"]',
    ]
    return selectors.some(sel => {
      try { return document.querySelector(sel) !== null }
      catch { return false }
    })
  }

  private detectMarkdownRendering(): boolean {
    const selectors = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'hr']
    let markdownElements = 0
    selectors.forEach(sel => {
      markdownElements += document.querySelectorAll(sel).length
    })
    return markdownElements > 3
  }

  private detectAIMetadata(): boolean {
    const title = document.title.toLowerCase()
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content')?.toLowerCase() || ''
    const metaKeywords = document.querySelector('meta[name="keywords"]')?.getAttribute('content')?.toLowerCase() || ''
    const aiKeywords = [
      'chat', 'ai', 'gpt', 'claude', 'gemini', 'llm', 'assistant',
      'copilot', 'chatbot', 'conversation',
    ]
    const text = `${title} ${metaDesc} ${metaKeywords}`
    return aiKeywords.some(kw => text.includes(kw))
  }

  private detectMessageRoles(): boolean {
    return document.querySelectorAll('[role="log"], [role="list"], [role="listitem"], [role="article"]').length >= 2
  }

  private detectStreaming(): boolean {
    return document.querySelectorAll(
      '[class*="typing"], [class*="streaming"], [class*="cursor"], [class*="loading"]'
    ).length > 0
  }
}
