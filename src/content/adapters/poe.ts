import { BaseAdapter } from './base-adapter'
import { Message } from '../../types'
import { UniversalInjector } from '../injection/universal-injector'

export class PoeAdapter extends BaseAdapter {
  name = 'poe'
  hostnames = ['poe.com']
  selectors = {
    messages: '[class*="Message"], [class*="message"]',
    userMessage: '[class*="user"], [class*="Message--user"]',
    assistantMessage: '[class*="assistant"], [class*="Message--bot"], [class*="Message--assistant"]',
    textarea: 'textarea, [contenteditable="true"]',
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
