import { PlatformRegistry } from './platform-registry'
import { ConfirmationDialog } from './ui/confirmation-dialog'
import { Message, BLOCKED_DOMAINS } from '../types'
import { getDomain, isSensitivePage } from '../utils/dom-utils'
import {
  isDomainDisabled,
  addTrustedDomain,
  addDisabledDomain,
  isExtensionEnabled,
} from '../utils/storage'
import { UniversalInjector } from './injection/universal-injector'
import { injectPromptForPlatform } from './injectors/index'

class ContextBridge {
  private registry: PlatformRegistry
  private dialog: ConfirmationDialog
  private initialized = false

  constructor() {
    this.registry = new PlatformRegistry()
    this.dialog = new ConfirmationDialog()
  }

  async initialize(): Promise<void> {
    if (this.initialized) return

    const enabled = await isExtensionEnabled()
    if (!enabled) return

    if (isSensitivePage()) {
      console.log('[Context Bridge] Sensitive page detected, skipping')
      return
    }

    const domain = getDomain()
    const isBlocked = BLOCKED_DOMAINS.some(b => domain.includes(b))
    if (isBlocked) {
      console.log('[Context Bridge] Blocked domain, skipping')
      return
    }

    const isDisabled = await isDomainDisabled(domain)
    if (isDisabled) return

    const { adapter, result, needsConfirmation } = await this.registry.detectCurrentPlatform()

    if (adapter) {
      this.initialized = true
      console.log(`[Context Bridge] Active platform: ${adapter.name}`)
      this.setupMessageListener()
      return
    }

    if (needsConfirmation) {
      const choice = await this.dialog.show(domain, result?.confidence || 0)

      if (choice === 'allow_once') {
        this.initialized = true
        console.log('[Context Bridge] User allowed for this session')
        await addTrustedDomain(domain, false)
        this.setupMessageListener()
      } else if (choice === 'allow_always') {
        this.initialized = true
        console.log('[Context Bridge] User always allows this domain')
        await addTrustedDomain(domain, true)
        this.setupMessageListener()
      } else {
        console.log('[Context Bridge] User denied')
        await addDisabledDomain(domain)
      }
    }
  }

  private setupMessageListener(): void {
    chrome.runtime.onMessage.addListener((
      message: { action: string; prompt?: string; platform?: string },
      sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void
    ) => {
      switch (message.action) {
        case 'extract':
          this.handleExtract(sendResponse)
          break
        case 'inject':
          this.handleInject(message.prompt || '', sendResponse)
          break
        case 'inject-migration':
          this.handleMigrationInject(message.prompt || '', message.platform || '', sendResponse)
          break
        case 'ping':
          sendResponse({ status: 'ok', platform: this.registry.getCurrentAdapter()?.name || 'unknown' })
          break
        default:
          sendResponse({ error: 'Unknown action' })
      }
      return true
    })
  }

  private handleExtract(sendResponse: (response?: unknown) => void): void {
    const adapter = this.registry.getCurrentAdapter()
    if (!adapter) {
      sendResponse({ messages: [], error: 'No active adapter' })
      return
    }

    try {
      const messages = adapter.extractMessages()

      if (messages.length === 0) {
        sendResponse({ messages: [], warning: 'No messages found on this page' })
        return
      }

      const formatted = this.formatMessages(messages)
      sendResponse({ messages, formatted })
    } catch (err) {
      sendResponse({ messages: [], error: String(err) })
    }
  }

  private handleInject(prompt: string, sendResponse: (response?: unknown) => void): void {
    const adapter = this.registry.getCurrentAdapter()
    if (!adapter) {
      sendResponse({ error: 'No active adapter' })
      return
    }

    adapter.injectPrompt(prompt)
      .then(() => sendResponse({ status: 'injected' }))
      .catch(err => sendResponse({ error: String(err) }))
  }

  private async handleMigrationInject(
    prompt: string,
    platform: string,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      const injector = new UniversalInjector()
      const result = await injector.inject(prompt)
      if (result.success && result.verified) {
        sendResponse({ status: 'injected', method: 'universal', platform, strategy: result.strategy })
        return
      }
      console.warn('[Context Bridge] Universal injection completed but not verified:', result)
    } catch (injectErr) {
      console.warn('[Context Bridge] Universal injection failed, trying platform adapters:', injectErr)
    }

    const adapter = this.registry.getCurrentAdapter()
    if (adapter) {
      try {
        await adapter.injectPrompt(prompt)
        sendResponse({ status: 'injected', method: 'adapter', platform })
        return
      } catch (err) {
        console.warn('[Context Bridge] Adapter injection failed:', err)
      }
    }

    try {
      await injectPromptForPlatform(prompt, 'generic')
      sendResponse({ status: 'injected', method: 'generic', platform })
      return
    } catch (err) {
      sendResponse({ error: `Could not inject context on this platform: ${err}`, platform })
    }
  }

  private formatMessages(messages: Message[]): string {
    return messages
      .map(msg => {
        const prefix = msg.role === 'user' ? '## User' : msg.role === 'assistant' ? '## Assistant' : '## System'
        return `${prefix}\n${msg.content}`
      })
      .join('\n\n')
  }
}

const bridge = new ContextBridge()
bridge.initialize()
