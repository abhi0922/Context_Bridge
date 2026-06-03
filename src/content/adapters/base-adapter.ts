import { PlatformAdapter, Message } from '../../types'

export abstract class BaseAdapter implements PlatformAdapter {
  abstract name: string
  abstract hostnames: string[]
  abstract selectors: Record<string, string>

  supportsStreaming: boolean = false
  supportsMarkdown: boolean = true

  detect(): boolean {
    return this.hostnames.some(h => window.location.hostname.includes(h))
  }

  getConfidenceScore(): number {
    return this.detect() ? 1.0 : 0.0
  }

  protected $(selector: string): Element | null {
    try {
      return document.querySelector(selector)
    } catch {
      return null
    }
  }

  protected $$(selector: string): NodeListOf<Element> {
    try {
      return document.querySelectorAll(selector)
    } catch {
      return document.querySelectorAll('')
    }
  }

  abstract extractMessages(): Message[]

  abstract injectPrompt(prompt: string): Promise<void>
}
