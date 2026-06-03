import { BaseAdapter } from './base-adapter'
import { Message } from '../../types'
import { UniversalInjector } from '../injection/universal-injector'

export class DeepSeekAdapter extends BaseAdapter {
  name = 'deepseek'
  hostnames = ['chat.deepseek.com', 'deepseek.com']
  selectors = {
    messages: '[class*="message"], [class*="chat"]',
    userMessage: '[class*="user"], [class*="UserMessage"]',
    assistantMessage: '[class*="assistant"], [class*="bot"], [class*="AssistantMessage"]',
    textarea: 'textarea, #chat-input',
    sendButton: '[class*="send"]',
  }

  supportsStreaming = true

  extractMessages(): Message[] {
    const messages: Message[] = []
    const allMessages = this.$$(this.selectors.messages)
    allMessages.forEach(el => {
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
