import { BaseAdapter } from './base-adapter'
import { Message } from '../../types'
import { UniversalInjector } from '../injection/universal-injector'

export class OpenRouterAdapter extends BaseAdapter {
  name = 'openrouter'
  hostnames = ['openrouter.ai']
  selectors = {
    messages: '[class*="message"], [class*="chat"]',
    userMessage: '[class*="user"]',
    assistantMessage: '[class*="assistant"], [class*="bot"], [class*="model"]',
    textarea: 'textarea, [contenteditable="true"]',
    sendButton: '[class*="send"], button[type="submit"]',
  }

  supportsStreaming = true

  extractMessages(): Message[] {
    const messages: Message[] = []
    this.$$(this.selectors.messages).forEach(el => {
      const text = el.textContent?.trim()
      if (!text) return
      const cls = Array.from(el.classList).map(c => c.toLowerCase()).join(' ')
      if (cls.includes('user')) messages.push({ role: 'user', content: text })
      else if (cls.includes('assistant') || cls.includes('bot')) messages.push({ role: 'assistant', content: text })
    })
    return messages
  }

  async injectPrompt(prompt: string): Promise<void> {
    const input = this.$(this.selectors.textarea) as HTMLElement
    if (input) {
      const injector = new UniversalInjector()
      await injector.injectInto(input, prompt)
    }
  }
}
