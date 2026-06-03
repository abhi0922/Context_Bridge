import { EditorCandidate, EditorType, DiscoverySignal } from '../../types'

const DEBUG = true
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log('[Context Bridge][Discovery]', ...args)
}

const CANDIDATE_SELECTORS = [
  'textarea:not([disabled])',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  '[contenteditable="plaintext-only"]',
  '.ProseMirror',
  '.ql-editor',
  '[data-lexical-editor]',
  '[data-slate-editor]',
  '[role="textbox"]:not([type="search"])',
  '[aria-multiline="true"]',
  'div[class*="input"] div[contenteditable="true"]',
  'div[class*="composer"] div[contenteditable="true"]',
  'div[class*="chat"] div[contenteditable="true"]',
  'div[class*="prompt"] textarea',
]

const KNOWN_PLATFORM_SELECTORS: Record<string, string[]> = {
  'chatgpt.com': ['#prompt-textarea', 'textarea[placeholder*="Message ChatGPT"]'],
  'chat.openai.com': ['#prompt-textarea', 'textarea[placeholder*="Message ChatGPT"]'],
  'claude.ai': ['.ProseMirror', 'div[contenteditable="true"][class*="composer"]'],
  'gemini.google.com': ['div[contenteditable="true"][role="textbox"]', 'div[class*="input"] div[contenteditable="true"]'],
  'perplexity.ai': ['textarea[placeholder*="Ask"]'],
  'grok.com': ['textarea'],
  'x.ai': ['textarea'],
  'poe.com': ['textarea', 'div[contenteditable="true"]'],
  'chat.deepseek.com': ['textarea', '#chat-input'],
  'deepseek.com': ['textarea', '#chat-input'],
  'openrouter.ai': ['textarea', 'div[contenteditable="true"]'],
}

export class EditorDiscoveryEngine {
  private debugLogs: string[] = []

  findBestEditor(): EditorCandidate | null {
    this.debugLogs = []
    const candidates = this.discoverCandidates()
    debugLog(`Found ${candidates.length} candidate editors`)

    if (candidates.length === 0) return null

    const scored = candidates
      .map(c => this.scoreCandidate(c))
      .filter(c => c.score >= 0)
      .sort((a, b) => b.score - a.score)

    scored.forEach((c, i) => {
      debugLog(`Candidate #${i + 1}: score=${c.score} selector="${c.selector}" type=${c.type} reason="${c.reason}"`)
    })

    return scored[0] || null
  }

  async findBestEditorWithRetry(maxRetries = 15, delayMs = 500): Promise<EditorCandidate | null> {
    for (let i = 0; i < maxRetries; i++) {
      const editor = this.findBestEditor()
      if (editor) {
        debugLog(`Editor found on attempt ${i + 1}: "${editor.selector}"`)
        return editor
      }
      await new Promise(r => setTimeout(r, delayMs))
    }
    debugLog(`No editor found after ${maxRetries} retries`)
    return null
  }

  getDebugLogs(): string[] {
    return this.debugLogs
  }

  private discoverCandidates(): HTMLElement[] {
    const seen = new Set<HTMLElement>()
    const candidates: HTMLElement[] = []

    const hostname = window.location.hostname
    const knownSelectors = KNOWN_PLATFORM_SELECTORS[hostname] || []

    const allSelectors = [...knownSelectors, ...CANDIDATE_SELECTORS]

    for (const selector of allSelectors) {
      try {
        const elements = document.querySelectorAll<HTMLElement>(selector)
        for (const el of elements) {
          if (!seen.has(el)) {
            seen.add(el)
            candidates.push(el)
          }
        }
      } catch {
      }
    }

    return candidates
  }

  private scoreCandidate(element: HTMLElement): EditorCandidate {
    const signals = this.gatherSignals(element)
    let score = 50

    for (const signal of signals) {
      score += this.signalWeight(signal)
    }

    score = Math.max(-1, score)

    const type = this.detectEditorType(element)
    const selector = this.buildSelector(element)
    const positiveSignals = signals.filter(s =>
      !['hidden', 'disabled', 'tooSmall', 'isSearchInput', 'inLoginForm', 'inForm'].includes(s)
    )
    const reason = positiveSignals.slice(0, 3).join(', ') || 'matched'

    return { element, score, selector, type, reason }
  }

  private gatherSignals(element: HTMLElement): DiscoverySignal[] {
    const signals: DiscoverySignal[] = []
    const style = window.getComputedStyle(element)
    const rect = element.getBoundingClientRect()

    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      signals.push('hidden')
      return signals
    }

    if (element.hasAttribute('disabled') || (element as HTMLTextAreaElement).disabled) {
      signals.push('disabled')
      return signals
    }

    if (rect.width === 0 || rect.height === 0) {
      signals.push('hidden')
      return signals
    }

    if (document.activeElement === element) signals.push('focused')

    const role = element.getAttribute('role')
    if (role === 'textbox') signals.push('hasRoleTextbox')

    if (element.isContentEditable) signals.push('isContentEditable')

    if (this.isNearSendButton(element)) signals.push('nearSendButton')

    if (rect.width > 200 && rect.height > 50) signals.push('largeSize')

    if (element.hasAttribute('placeholder')) signals.push('hasPlaceholder')

    if (element.getAttribute('aria-multiline') === 'true') signals.push('hasAriaMultiline')

    if (element.classList.contains('ProseMirror')) signals.push('isProseMirror')
    if (element.classList.contains('ql-editor')) signals.push('isQuill')
    if (element.hasAttribute('data-lexical-editor')) signals.push('isLexical')
    if (element.hasAttribute('data-slate-editor')) signals.push('isSlate')

    if (this.isInMainContent(element)) signals.push('inMainContent')

    const ariaLabel = (element.getAttribute('aria-label') || '').toLowerCase()
    const placeholder = (element.getAttribute('placeholder') || '').toLowerCase()
    if (
      element.tagName.toLowerCase() === 'input' && element.getAttribute('type') === 'search' ||
      ariaLabel.includes('search') ||
      placeholder.includes('search')
    ) {
      signals.push('isSearchInput')
    }

    if (rect.width < 100 || rect.height < 20) signals.push('tooSmall')

    if (element.closest('form') && !element.closest('[role="textbox"], [class*="composer"], [class*="input"]')) {
      const form = element.closest('form')
      if (form && (form.querySelector('input[type="password"]') || form.querySelector('input[type="email"]'))) {
        signals.push('inLoginForm')
      } else {
        signals.push('inForm')
      }
    }

    return signals
  }

  private signalWeight(signal: DiscoverySignal): number {
    const weights: Record<DiscoverySignal, number> = {
      focused: 25,
      hasRoleTextbox: 15,
      isContentEditable: 10,
      nearSendButton: 20,
      largeSize: 10,
      hasPlaceholder: 5,
      hasAriaMultiline: 5,
      isProseMirror: 10,
      isQuill: 10,
      isLexical: 10,
      isSlate: 10,
      inMainContent: 10,
      inForm: -10,
      isSearchInput: -100,
      tooSmall: -50,
      inLoginForm: -100,
      hidden: -10000,
      disabled: -10000,
    }
    return weights[signal] || 0
  }

  private isNearSendButton(element: HTMLElement): boolean {
    const sendSelectors = [
      'button[type="submit"]',
      '[aria-label*="send" i]',
      '[class*="send"]:not([class*="message"])',
      '[class*="submit"]',
    ]

    const parent = element.parentElement
    if (!parent) return false

    for (const sel of sendSelectors) {
      try {
        if (parent.querySelector(sel)) return true
        if (parent.parentElement?.querySelector(sel)) return true
      } catch {
      }
    }

    const siblings = Array.from(parent.children).filter(c => c !== element)
    for (const sibling of siblings) {
      const text = sibling.textContent?.toLowerCase() || ''
      if (text.includes('send') || text.includes('submit')) return true
      const aria = (sibling as HTMLElement).getAttribute('aria-label')?.toLowerCase() || ''
      if (aria.includes('send') || aria.includes('submit')) return true
    }

    return false
  }

  private isInMainContent(element: HTMLElement): boolean {
    let current = element.parentElement
    while (current) {
      const tag = current.tagName.toLowerCase()
      if (['header', 'footer', 'nav', 'sidebar', 'aside'].includes(tag)) return false
      if (current.getAttribute('role') === 'navigation' || current.getAttribute('role') === 'banner') return false
      current = current.parentElement
    }
    return true
  }

  private detectEditorType(element: HTMLElement): EditorType {
    if (element.classList.contains('ProseMirror')) return 'prosemirror'
    if (element.classList.contains('ql-editor')) return 'quill'
    if (element.hasAttribute('data-lexical-editor')) return 'lexical'
    if (element.hasAttribute('data-slate-editor')) return 'slate'
    if (element.isContentEditable) return 'contenteditable'
    if (element.tagName.toLowerCase() === 'textarea') return 'textarea'
    return 'custom'
  }

  private buildSelector(element: HTMLElement): string {
    if (element.id) return `#${element.id}`
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(/\s+/).filter(Boolean).slice(0, 3)
      if (classes.length > 0) return `${element.tagName.toLowerCase()}.${classes.join('.')}`
    }
    const role = element.getAttribute('role')
    if (role) return `${element.tagName.toLowerCase()}[role="${role}"]`
    return element.tagName.toLowerCase()
  }
}
