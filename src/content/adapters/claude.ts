import { BaseAdapter } from './base-adapter'
import { Message } from '../../types'
import { UniversalInjector } from '../injection/universal-injector'

export class ClaudeAdapter extends BaseAdapter {
  name = 'claude'
  hostnames = ['claude.ai']
  selectors = {
    messages: '[class*="message"]',
    userMessage: '[class*="message-user"]',
    assistantMessage: '[class*="message-assistant"], [class*="message-claude"]',
    textarea: '[class*="input"] textarea, div[contenteditable="true"][class*="input"]',
    sendButton: '[class*="send"]',
  }

  supportsStreaming = true

  extractMessages(): Message[] {
    const messages: Message[] = []
    const userEls = this.$$(this.selectors.userMessage)
    const assistantEls = this.$$(this.selectors.assistantMessage)

    userEls.forEach(el => {
      const content = el.textContent?.trim()
      if (content) messages.push({ role: 'user', content })
    })

    assistantEls.forEach(el => {
      const content = el.textContent?.trim()
      if (content) messages.push({ role: 'assistant', content })
    })

    messages.sort((a, b) => {
      const aIdx = Array.from(this.$$('[class*="message"]')).findIndex(
        m => m.textContent?.includes(a.content.substring(0, 50))
      )
      const bIdx = Array.from(this.$$('[class*="message"]')).findIndex(
        m => m.textContent?.includes(b.content.substring(0, 50))
      )
      return aIdx - bIdx
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
