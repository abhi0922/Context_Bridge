const GEMINI_SELECTORS = [
  'div[contenteditable="true"][role="textbox"]',
  'div[contenteditable="true"][class*="input"]',
  'div[contenteditable="true"]',
  '[class*="input-area"] textarea',
  '[class*="input"] textarea',
  '[class*="editor"]',
  '.ProseMirror',
  '.ql-editor',
]

const MAX_RETRIES = 20
const RETRY_DELAY = 500

export async function injectGemini(prompt: string): Promise<void> {
  console.log('[Context Bridge] Injecting into Gemini...')

  const editor = await waitForEditor()
  if (!editor) {
    throw new Error('Gemini editor not found after retries')
  }

  console.log('[Context Bridge] Gemini editor found:', editor.tagName, editor.className)

  editor.focus()
  await sleep(100)

  const success = insertTextSmart(editor, prompt)
  if (!success) {
    throw new Error('Failed to insert text into Gemini editor')
  }

  dispatchInputEvents(editor)
  console.log('[Context Bridge] Gemini injection complete')
}

async function waitForEditor(): Promise<HTMLElement | null> {
  for (let i = 0; i < MAX_RETRIES; i++) {
    for (const selector of GEMINI_SELECTORS) {
      const el = document.querySelector<HTMLElement>(selector)
      if (el && isVisible(el)) {
        console.log(`[Context Bridge] Gemini editor found via selector: "${selector}" (attempt ${i + 1})`)
        return el
      }
    }

    const allEditable = document.querySelectorAll<HTMLElement>('[contenteditable="true"]')
    for (const el of allEditable) {
      if (isVisible(el) && el.getAttribute('role') === 'textbox') {
        console.log(`[Context Bridge] Gemini editor found via contenteditable+role (attempt ${i + 1})`)
        return el
      }
    }

    for (const el of allEditable) {
      if (isVisible(el) && isLargeInput(el)) {
        console.log(`[Context Bridge] Gemini editor found via contenteditable+size (attempt ${i + 1})`)
        return el
      }
    }

    await sleep(RETRY_DELAY)
  }

  return null
}

function isVisible(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el)
  if (style.display === 'none' || style.visibility === 'hidden') return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

function isLargeInput(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect()
  return rect.width > 200 && rect.height > 30
}

function insertTextSmart(element: HTMLElement, text: string): boolean {
  if (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement) {
    const start = element.selectionStart ?? element.value.length
    const end = element.selectionEnd ?? element.value.length
    const before = element.value.substring(0, start)
    const after = element.value.substring(end)
    element.value = before + text + after
    element.selectionStart = element.selectionEnd = start + text.length
    return true
  }

  try {
    element.focus()

    const selection = window.getSelection()
    if (!selection) return false

    const range = document.createRange()
    range.selectNodeContents(element)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)

    const inserted = document.execCommand('insertText', false, text)
    if (inserted) return true

    range.deleteContents()
    const textNode = document.createTextNode(text)
    range.insertNode(textNode)
    range.setStartAfter(textNode)
    range.setEndAfter(textNode)
    selection.removeAllRanges()
    selection.addRange(range)

    return element.textContent?.includes(text) ?? false
  } catch (err) {
    console.warn('[Context Bridge] Smart insert error, trying innerText fallback:', err)
    try {
      element.textContent = text
      return element.textContent?.includes(text) ?? false
    } catch {
      return false
    }
  }
}

function dispatchInputEvents(element: HTMLElement): void {
  const inputEvent = new InputEvent('input', {
    bubbles: true,
    cancelable: true,
    composed: true,
    inputType: 'insertText',
    data: null,
  })
  element.dispatchEvent(inputEvent)

  element.dispatchEvent(new Event('change', { bubbles: true }))
  element.dispatchEvent(new Event('keyup', { bubbles: true }))

  element.dispatchEvent(
    new KeyboardEvent('keydown', { bubbles: true, key: ' ', code: 'Space' })
  )
  element.dispatchEvent(
    new KeyboardEvent('keyup', { bubbles: true, key: ' ', code: 'Space' })
  )

  element.dispatchEvent(new FocusEvent('focus', { bubbles: true }))

  console.log('[Context Bridge] Input events dispatched')
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
