import { BaseAdapter } from './base-adapter'
import { Message } from '../../types'
import { UniversalInjector } from '../injection/universal-injector'

export class PerplexityAdapter extends BaseAdapter {
  name = 'perplexity'
  hostnames = ['perplexity.ai', 'www.perplexity.ai']
  selectors = {
    messages: '[class*="message"], [class*="thread"]',
    userMessage: '[class*="user"], [class*="query"]',
    assistantMessage: '[class*="assistant"], [class*="answer"], [class*="response"]',
    textarea: 'textarea[placeholder*="Ask"], [contenteditable="true"]',
    sendButton: '[class*="send"], button[type="submit"]',
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
