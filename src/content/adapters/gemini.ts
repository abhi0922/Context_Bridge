import { BaseAdapter } from './base-adapter'
import { Message } from '../../types'
import { UniversalInjector } from '../injection/universal-injector'

export class GeminiAdapter extends BaseAdapter {
  name = 'gemini'
  hostnames = ['gemini.google.com']
  selectors = {
    messages: '[class*="conversation"] [class*="message"], [class*="response-container"]',
    userMessage: '[class*="user"], [class*="query"]',
    assistantMessage: '[class*="model"], [class*="response"]',
    textarea: 'textarea, [contenteditable="true"][class*="input"], [class*="input-area"]',
    sendButton: '[class*="send"]',
  }

  supportsStreaming = true

  extractMessages(): Message[] {
    const messages: Message[] = []
    const allMessages = this.$$(this.selectors.messages)

    allMessages.forEach(el => {
      const text = el.textContent?.trim()
      if (!text) return

      const isUser = el.matches(this.selectors.userMessage) ||
        Array.from(el.classList).some(c => c.toLowerCase().includes('user'))
      const isAssistant = el.matches(this.selectors.assistantMessage) ||
        Array.from(el.classList).some(c => c.toLowerCase().includes('model') || c.toLowerCase().includes('response'))

      if (isUser) messages.push({ role: 'user', content: text })
      else if (isAssistant) messages.push({ role: 'assistant', content: text })
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
