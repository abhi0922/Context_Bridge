import { BaseAdapter } from './base-adapter'
import { Message } from '../../types'
import { UniversalInjector } from '../injection/universal-injector'

export class ChatGPTAdapter extends BaseAdapter {
  name = 'chatgpt'
  hostnames = ['chatgpt.com', 'chat.openai.com']
  selectors = {
    messages: '[data-message-author-role]',
    userMessage: '[data-message-author-role="user"]',
    assistantMessage: '[data-message-author-role="assistant"]',
    textarea: '#prompt-textarea, textarea[placeholder*="Message ChatGPT"]',
    sendButton: '[data-testid="send-button"]',
  }

  supportsStreaming = true

  extractMessages(): Message[] {
    const messages: Message[] = []
    const elements = this.$$(this.selectors.messages)

    elements.forEach(el => {
      const role = el.getAttribute('data-message-author-role') as 'user' | 'assistant' | null
      if (!role || (role !== 'user' && role !== 'assistant')) return

      const contentEl = el.querySelector('.whitespace-pre-wrap, .markdown, [class*="markdown"]')
      const content = contentEl?.textContent?.trim() || (el as HTMLElement).innerText?.trim()
      if (!content) return

      messages.push({
        role,
        content,
        id: el.getAttribute('data-message-id') || undefined,
      })
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
