import { BaseAdapter } from './base-adapter'
import { Message } from '../../types'
import { UniversalInjector } from '../injection/universal-injector'

export class GrokAdapter extends BaseAdapter {
  name = 'grok'
  hostnames = ['grok.com', 'x.ai']
  selectors = {
    messages: '[class*="message"], [class*="chat"]',
    userMessage: '[class*="user"], [class*="human"]',
    assistantMessage: '[class*="assistant"], [class*="grok"]',
    textarea: 'textarea, [contenteditable="true"]',
    sendButton: '[class*="send"], [class*="submit"]',
  }

  extractMessages(): Message[] {
    const messages: Message[] = []
    const allMessages = this.$$(this.selectors.messages)

    allMessages.forEach(el => {
      const text = el.textContent?.trim()
      if (!text) return
      const classes = Array.from(el.classList).map(c => c.toLowerCase()).join(' ')
      if (classes.includes('user') || classes.includes('human')) {
        messages.push({ role: 'user', content: text })
      } else if (classes.includes('assistant') || classes.includes('grok') || classes.includes('bot')) {
        messages.push({ role: 'assistant', content: text })
      }
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
