import { InjectionResult, InjectionAttempt, InjectionStrategyName, EditorCandidate, EditorType } from '../../types'
import { EditorDiscoveryEngine } from './editor-discovery'
import { PlatformMemory } from './platform-memory'

const DEBUG = true
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log('[Context Bridge][Injection]', ...args)
}

const RETRY_MAX = 15
const RETRY_DELAY = 500

export class UniversalInjector {
  private discovery: EditorDiscoveryEngine
  private memory: PlatformMemory

  constructor() {
    this.discovery = new EditorDiscoveryEngine()
    this.memory = new PlatformMemory()
  }

  async injectInto(element: HTMLElement, prompt: string): Promise<InjectionResult> {
    const hostname = window.location.hostname
    const type = this.detectType(element)
    const selector = this.buildSelector(element)
    debugLog(`Injecting into specific element: ${selector} type=${type}`)

    const candidate: EditorCandidate = {
      element,
      score: 100,
      selector,
      type,
      reason: 'direct',
    }

    const inner = await this.injectIntoElement(candidate, prompt)
    const result: InjectionResult = {
      ...inner,
      editorSelector: selector,
      editorType: type,
    }

    if (result.success) {
      await this.memory.recordSuccess(hostname, selector, type, result.strategy)
    }

    return result
  }

  async inject(prompt: string): Promise<InjectionResult> {
    const hostname = window.location.hostname
    debugLog(`Starting injection on ${hostname}`)
    debugLog(`Prompt length: ${prompt.length} chars`)

    const memoryEntry = await this.memory.getBestEntry(hostname)
    if (memoryEntry) {
      debugLog(`Found platform memory entry: selector="${memoryEntry.editorSelector}" strategy=${memoryEntry.strategy}`)
      const memResult = await this.tryInjectionWithMemory(prompt, memoryEntry)
      if (memResult.success) {
        await this.memory.recordSuccess(
          hostname, memoryEntry.editorSelector, memoryEntry.editorType, memoryEntry.strategy
        )
        return memResult
      }
      await this.memory.recordFailure(
        hostname, memoryEntry.editorSelector, memoryEntry.strategy
      )
    }

    debugLog('Discovering editors...')
    const candidate = await this.discovery.findBestEditorWithRetry(RETRY_MAX, RETRY_DELAY)

    if (!candidate) {
      debugLog('No editor candidate found')
      return {
        success: false,
        strategy: 'none',
        attempts: [],
        editorSelector: 'none',
        editorType: 'custom',
        verified: false,
      }
    }

    debugLog(`Best candidate: score=${candidate.score} selector="${candidate.selector}" type=${candidate.type}`)
    debugLog(`Reason: ${candidate.reason}`)

    const result = await this.injectIntoElement(candidate, prompt)

    if (result.success) {
      await this.memory.recordSuccess(hostname, candidate.selector, candidate.type, result.strategy)
    }

    return {
      ...result,
      editorSelector: candidate.selector,
      editorType: candidate.type,
    }
  }

  private async tryInjectionWithMemory(
    prompt: string,
    entry: { editorSelector: string; editorType: EditorType; strategy: InjectionStrategyName }
  ): Promise<InjectionResult> {
    const base = { editorSelector: entry.editorSelector, editorType: entry.editorType }
    try {
      const element = document.querySelector<HTMLElement>(entry.editorSelector)
      if (!element) {
        debugLog('Memory editor not found in DOM')
        return { success: false, strategy: entry.strategy, attempts: [], verified: false, ...base }
      }

      const candidate: EditorCandidate = {
        element,
        score: 100,
        selector: entry.editorSelector,
        type: entry.editorType,
        reason: 'platform memory',
      }

      const inner = await this.injectIntoElement(candidate, prompt)
      return { ...base, ...inner }
    } catch (err) {
      debugLog('Memory injection failed:', err)
      return { success: false, strategy: entry.strategy, attempts: [], verified: false, ...base }
    }
  }

  private async injectIntoElement(candidate: EditorCandidate, prompt: string): Promise<{
    success: boolean; strategy: InjectionStrategyName; attempts: InjectionAttempt[]; verified: boolean
  }> {
    const { element } = candidate
    const strategies: InjectionStrategyName[] = [
      'execCommand',
      'selectionRange',
      'nativeValue',
      'innerText',
      'clipboardPaste',
    ]

    const attempts: InjectionAttempt[] = []

    for (const strategy of strategies) {
      debugLog(`Trying strategy: ${strategy}`)
      let attempt: InjectionAttempt

      try {
        const success = this.tryStrategy(strategy, element, prompt)
        if (success) {
          this.dispatchEvents(element)
          const verified = this.verifyContent(element, prompt)
          attempt = { strategy, success: true }
          debugLog(`Strategy ${strategy}: success, verified=${verified}`)

          if (verified) {
            attempts.push(attempt)
            return { success: true, strategy, attempts, verified: true }
          }

          attempts.push(attempt)
        } else {
          attempt = { strategy, success: false }
          debugLog(`Strategy ${strategy}: failed (returned false)`)
        }
      } catch (err) {
        attempt = { strategy, success: false, error: String(err) }
        debugLog(`Strategy ${strategy}: error - ${err}`)
      }

      attempts.push(attempt)
    }

    debugLog('All strategies exhausted')
    return { success: false, strategy: 'none', attempts, verified: false }
  }

  private tryStrategy(strategy: InjectionStrategyName, element: HTMLElement, text: string): boolean {
    switch (strategy) {
      case 'execCommand': return this.strategyExecCommand(element, text)
      case 'selectionRange': return this.strategySelectionRange(element, text)
      case 'nativeValue': return this.strategyNativeValue(element, text)
      case 'innerText': return this.strategyInnerText(element, text)
      case 'clipboardPaste': return this.strategyClipboardPaste(element, text)
      default: return false
    }
  }

  private strategyExecCommand(element: HTMLElement, text: string): boolean {
    element.focus()

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const start = element.selectionStart ?? 0
      const end = element.selectionEnd ?? 0
      const before = element.value.substring(0, start)
      const after = element.value.substring(end)
      element.value = before + text + after
      element.selectionStart = element.selectionEnd = start + text.length
      return true
    }

    const selection = window.getSelection()
    if (!selection) return false

    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)

    if (document.execCommand('insertText', false, text)) return true

    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    selection.removeAllRanges()
    selection.addRange(range)

    return element.textContent?.includes(text) ?? false
  }

  private strategySelectionRange(element: HTMLElement, text: string): boolean {
    element.focus()

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      const start = element.selectionStart ?? 0
      const end = element.selectionEnd ?? 0
      const before = element.value.substring(0, start)
      const after = element.value.substring(end)
      element.value = before + text + after
      element.selectionStart = element.selectionEnd = start + text.length
      return true
    }

    const selection = window.getSelection()
    if (!selection) return false

    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)

    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    selection.removeAllRanges()
    selection.addRange(range)

    return true
  }

  private strategyNativeValue(element: HTMLElement, text: string): boolean {
    if (!(element instanceof HTMLTextAreaElement) && !(element instanceof HTMLInputElement)) return false

    element.focus()
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? element.value.length
    const before = element.value.substring(0, start)
    const after = element.value.substring(end)
    element.value = before + text + after
    element.selectionStart = element.selectionEnd = start + text.length

    return element.value.includes(text)
  }

  private strategyInnerText(element: HTMLElement, text: string): boolean {
    element.focus()

    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      element.value = text
      return element.value.includes(text)
    }

    try {
      element.textContent = text
      return element.textContent?.includes(text) ?? false
    } catch {
      return false
    }
  }

  private strategyClipboardPaste(element: HTMLElement, text: string): boolean {
    element.focus()

    try {
      const dt = new DataTransfer()
      dt.setData('text/plain', text)
      const event = new ClipboardEvent('paste', {
        clipboardData: dt,
        bubbles: true,
        cancelable: true,
        composed: true,
      })
      return element.dispatchEvent(event)
    } catch {
      return false
    }
  }

  private verifyContent(element: HTMLElement, text: string): boolean {
    if (!text) return false

    try {
      if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
        return element.value.includes(text)
      }

      const textContent = element.textContent || ''
      if (textContent.includes(text)) return true

      const textSuffix = text.slice(-200)
      if (textSuffix.length > 20 && textContent.includes(textSuffix)) return true

      const textPrefix = text.slice(0, 100)
      if (textPrefix.length > 20 && textContent.includes(textPrefix)) return true

      return element.innerHTML.includes(this.escapeHtml(text.slice(0, 100)))
    } catch {
      return false
    }
  }

  private dispatchEvents(element: HTMLElement): void {
    try {
      element.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        cancelable: true,
        composed: true,
        inputType: 'insertText',
      }))

      element.dispatchEvent(new Event('change', { bubbles: true }))
      element.dispatchEvent(new Event('input', { bubbles: true }))
      element.dispatchEvent(new Event('keyup', { bubbles: true }))
      element.dispatchEvent(new FocusEvent('focus', { bubbles: true }))

      element.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true,
        key: 'Enter',
        code: 'Enter',
        composed: true,
      }))
      element.dispatchEvent(new KeyboardEvent('keyup', {
        bubbles: true,
        key: 'Enter',
        code: 'Enter',
        composed: true,
      }))

      element.dispatchEvent(new Event('compositionend', { bubbles: true }))

      const parentForm = element.closest('form')
      if (parentForm) {
        parentForm.dispatchEvent(new Event('input', { bubbles: true }))
      }
    } catch {
    }
  }

  private detectType(element: HTMLElement): EditorType {
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

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
  }
}
