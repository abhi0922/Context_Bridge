export function getHostname(): string {
  return window.location.hostname
}

export function getDomain(): string {
  return window.location.hostname.replace(/^www\./, '')
}

export function isSensitivePage(): boolean {
  const hostname = getHostname()
  const url = window.location.href.toLowerCase()
  const sensitivePatterns = [
    /bank/i, /payment/i, /checkout/i, /login/i,
    /password/i, /credential/i, /sign[-]?in/i,
    /gov\./i, /irs\./i, /treasury/i,
  ]
  return sensitivePatterns.some(p => p.test(hostname) || p.test(url))
}

export function focusAndInsert(element: HTMLElement, text: string): void {
  element.focus()

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart || 0
    const end = element.selectionEnd || 0
    const before = element.value.substring(0, start)
    const after = element.value.substring(end)
    element.value = before + text + after
    element.selectionStart = element.selectionEnd = start + text.length
  } else if (element.isContentEditable) {
    const selection = window.getSelection()
    if (selection) {
      const range = document.createRange()
      range.selectNodeContents(element)
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)

      if (!document.execCommand('insertText', false, text)) {
        range.deleteContents()
        const textNode = document.createTextNode(text)
        range.insertNode(textNode)
        range.setStartAfter(textNode)
        range.setEndAfter(textNode)
        selection.removeAllRanges()
        selection.addRange(range)
      }
    }
  }

  dispatchNativeInputEvents(element)
}

export function dispatchNativeInputEvents(element: HTMLElement): void {
  element.dispatchEvent(new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
  }))

  element.dispatchEvent(new Event('change', { bubbles: true }))
  element.dispatchEvent(new Event('input', { bubbles: true }))

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    element.dispatchEvent(new Event('keyup', { bubbles: true }))
  }
}

export function detectInputElement(): HTMLElement | null {
  const editors = document.querySelectorAll<HTMLElement>(
    'textarea, [contenteditable="true"], [contenteditable="plaintext-only"], .ProseMirror, .ql-editor'
  )
  for (const el of editors) {
    const rect = el.getBoundingClientRect()
    const style = window.getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    if (rect.width > 100 && rect.height > 30) return el
  }
  return null
}
