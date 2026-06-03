import { Message } from '../../types'

export class GenericExtractor {
  extract(): Message[] {
    const containers = this.findMessageContainers()
    if (containers.length === 0) return this.extractFallback()

    const messages: Message[] = []
    const seen = new Set<string>()

    containers.forEach(el => {
      const text = el.textContent?.trim()
      if (!text || text.length < 2 || seen.has(text)) return
      seen.add(text)

      const role = this.inferRole(el)
      messages.push({
        role,
        content: this.extractContent(el),
      })
    })

    return messages
  }

  private findMessageContainers(): Element[] {
    const candidates = new Map<Element, number>()

    const queryAll = (selector: string) => {
      document.querySelectorAll(selector).forEach(el => {
        candidates.set(el, (candidates.get(el) || 0) + 1)
      })
    }

    queryAll('[class*="message"]')
    queryAll('[class*="chat"]')
    queryAll('[class*="conversation"]')
    queryAll('[class*="thread"]')
    queryAll('[class*="response"]')
    queryAll('[role="article"]')
    queryAll('[role="listitem"]')

    const messageLike = document.querySelectorAll(
      'div[class*="user"], div[class*="assistant"], div[class*="bot"], ' +
      'div[class*="human"], div[class*="ai"], div[class*="model"]'
    )
    messageLike.forEach(el => {
      if (!Array.from(el.classList).some(c => c === 'user' || c === 'assistant' || c === 'bot')) return
      if (el.textContent && el.textContent.trim().length > 20) {
        candidates.set(el, (candidates.get(el) || 0) + 2)
      }
    })

    const sorted = Array.from(candidates.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([el]) => el)
      .filter(el => el.textContent && el.textContent.trim().length > 20)

    return sorted.slice(0, 50)
  }

  private inferRole(element: Element): 'user' | 'assistant' | 'system' {
    const cls = Array.from(element.classList).map(c => c.toLowerCase()).join(' ')
    const html = (element as HTMLElement).innerHTML?.toLowerCase() || ''
    const parentCls = element.parentElement
      ? Array.from(element.parentElement.classList).map(c => c.toLowerCase()).join(' ')
      : ''

    const allCls = `${cls} ${parentCls}`

    if (allCls.includes('user') || allCls.includes('human') || allCls.includes('self') || allCls.includes('query')) {
      return 'user'
    }
    if (allCls.includes('assistant') || allCls.includes('ai') || allCls.includes('bot') ||
        allCls.includes('model') || allCls.includes('gpt') || allCls.includes('claude') ||
        allCls.includes('response') || allCls.includes('answer')) {
      return 'assistant'
    }
    if (allCls.includes('system') || allCls.includes('instruction')) {
      return 'system'
    }

    if (html.includes('data-message-author-role="user"') || html.includes('data-message-role="user"')) return 'user'
    if (html.includes('data-message-author-role="assistant"') || html.includes('data-message-role="assistant"')) return 'assistant'

    return 'user'
  }

  private extractContent(element: Element): string {
    const codeBlocks: string[] = []
    element.querySelectorAll('pre code, pre, code[class*="language-"]').forEach(block => {
      const code = block.textContent?.trim()
      if (code && code.length > 5) {
        codeBlocks.push(code)
      }
    })

    const clone = element.cloneNode(true) as HTMLElement
    clone.querySelectorAll('pre code, pre, code[class*="language-"]').forEach(el => el.remove())

    let text = clone.textContent?.trim() || ''

    if (codeBlocks.length > 0) {
      text += '\n\n```\n' + codeBlocks.join('\n\n```\n\n```\n') + '\n```'
    }

    return text
  }

  private extractFallback(): Message[] {
    const messages: Message[] = []
    const potentialContainers = document.querySelectorAll(
      'main article, main div, section div, .content div'
    )

    potentialContainers.forEach(el => {
      if (!el.textContent || el.textContent.trim().length < 50) return
      if (el.children.length === 0) return

      const children = Array.from(el.children).filter(c => {
        const t = c.textContent?.trim()
        return t && t.length > 20
      })

      if (children.length >= 2) {
        let isUser = true
        children.forEach(child => {
          messages.push({
            role: isUser ? 'user' : 'assistant',
            content: child.textContent?.trim() || '',
          })
          isUser = !isUser
        })
      }
    })

    return messages
  }
}
