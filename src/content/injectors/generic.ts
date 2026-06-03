const UNIVERSAL_SELECTORS = [
  'textarea',
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"]',
  '[contenteditable="true"]',
  '.ProseMirror',
  '.ql-editor',
  '[data-slate-editor]',
  '[contenteditable="plaintext-only"]',
]

const MAX_RETRIES = 15
const RETRY_DELAY = 500

export async function injectGeneric(prompt: string): Promise<void> {
  console.log('[Context Bridge] Using generic injector...')

  const editor = await waitForAnyEditor()
  if (!editor) {
    throw new Error('No input element found for injection')
  }

  editor.focus()
  await sleep(100)

  const success = insertTextContent(editor, prompt)
  if (!success) {
    throw new Error('Failed to insert text into editor')
  }

  dispatchNativeEvents(editor)
  console.log('[Context Bridge] Generic injection complete:', editor.tagName, editor.className)
}

async function waitForAnyEditor(): Promise<HTMLElement | null> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    for (const selector of UNIVERSAL_SELECTORS) {
      const elements = document.querySelectorAll<HTMLElement>(selector)
      for (const el of elements) {
        if (isVisibleAndLarge(el)) {
          console.log(`[Context Bridge] Editor found: "${selector}" (attempt ${i + 1})`)
          return el
        }
      }
    }

    await sleep(RETRY_DELAY)
  }

  const allInputs = document.querySelectorAll<HTMLElement>('textarea, [contenteditable="true"]')
  for (const el of allInputs) {
    if (isVisibleAndLarge(el)) return el
  }

  return null
}

function isVisibleAndLarge(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 100 && rect.height > 30
}

function insertTextContent(element: HTMLElement, text: string): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? 0
    const end = element.selectionEnd ?? 0
    const before = element.value.substring(0, start)
    const after = element.value.substring(end)
    element.value = before + text + after
    element.selectionStart = element.selectionEnd = start + text.length
    return true
  }

  try {
    element.focus()
    const selection = window.getSelection()
    if (!selection) return setFallback(element, text)

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
  } catch {
    return setFallback(element, text)
  }
}

function setFallback(element: HTMLElement, text: string): boolean {
  try {
    if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
      element.value = text
    } else {
      element.textContent = text
    }
    return true
  } catch {
    return false
  }
}

function dispatchNativeEvents(element: HTMLElement): void {
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

  const parentForm = element.closest('form')
  if (parentForm) {
    parentForm.dispatchEvent(new Event('input', { bubbles: true }))
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
