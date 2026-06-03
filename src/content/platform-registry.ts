import { PlatformAdapter, DetectionResult } from '../types'
import { BaseAdapter } from './adapters/base-adapter'
import { ChatGPTAdapter } from './adapters/chatgpt'
import { ClaudeAdapter } from './adapters/claude'
import { GeminiAdapter } from './adapters/gemini'
import { PerplexityAdapter } from './adapters/perplexity'
import { GrokAdapter } from './adapters/grok'
import { PoeAdapter } from './adapters/poe'
import { DeepSeekAdapter } from './adapters/deepseek'
import { OpenRouterAdapter } from './adapters/openrouter'
import { CursorAdapter } from './adapters/cursor'
import { LovableAdapter } from './adapters/lovable'
import { BoltNewAdapter } from './adapters/boltdotnew'
import { V0Adapter } from './adapters/v0'
import { WindsurfAdapter } from './adapters/windsurf'
import { GenericDetector } from './detection/generic-detector'
import { GenericExtractor } from './extraction/generic-extractor'
import { UniversalInjector } from './injection/universal-injector'
import { isDomainAlwaysTrusted, isDomainDisabled, addTrustedDomain, addDisabledDomain } from '../utils/storage'
import { getDomain } from '../utils/dom-utils'

export class PlatformRegistry {
  private knownAdapters: BaseAdapter[] = []
  private genericDetector: GenericDetector
  private genericExtractor: GenericExtractor
  private universalInjector: UniversalInjector
  private currentAdapter: PlatformAdapter | null = null

  constructor() {
    this.registerKnownAdapters()
    this.genericDetector = new GenericDetector()
    this.genericExtractor = new GenericExtractor()
    this.universalInjector = new UniversalInjector()
  }

  private registerKnownAdapters(): void {
    const adapters = [
      new ChatGPTAdapter(),
      new ClaudeAdapter(),
      new GeminiAdapter(),
      new PerplexityAdapter(),
      new GrokAdapter(),
      new PoeAdapter(),
      new DeepSeekAdapter(),
      new OpenRouterAdapter(),
      new CursorAdapter(),
      new LovableAdapter(),
      new BoltNewAdapter(),
      new V0Adapter(),
      new WindsurfAdapter(),
    ]
    this.knownAdapters.push(...adapters)
  }

  register(adapter: BaseAdapter): void {
    this.knownAdapters.push(adapter)
  }

  async detectCurrentPlatform(): Promise<{
    adapter: PlatformAdapter | null
    result: DetectionResult | null
    needsConfirmation: boolean
  }> {
    // Layer 1: Known platform adapters
    for (const adapter of this.knownAdapters) {
      if (adapter.detect()) {
        this.currentAdapter = adapter
        return {
          adapter,
          result: {
            isAIChat: true,
            confidence: 1.0,
            signals: {
              hasTextarea: false,
              hasContentEditable: false,
              hasCodeBlocks: false,
              hasConversationFlow: false,
              hasSendButton: false,
              hasMarkdownRendering: false,
              hasAIRelatedMetadata: false,
              hasMessageRoles: false,
              hasStreamingIndicator: false,
            },
            platform: adapter.name,
          },
          needsConfirmation: false,
        }
      }
    }

    const domain = getDomain()
    const isDisabled = await isDomainDisabled(domain)
    if (isDisabled) {
      return { adapter: null, result: null, needsConfirmation: false }
    }

    // Layer 2: Generic AI chat detection
    const detectionResult = this.genericDetector.detect()
    if (detectionResult.isAIChat) {
      this.currentAdapter = this.createGenericAdapter(detectionResult)
      return {
        adapter: this.currentAdapter,
        result: detectionResult,
        needsConfirmation: false,
      }
    }

    // Layer 3: User confirmation mode (uncertain detection)
    const isTrusted = await isDomainAlwaysTrusted(domain)
    if (isTrusted) {
      const fallbackResult: DetectionResult = {
        isAIChat: true,
        confidence: 0.5,
        signals: {
          hasTextarea: false,
          hasContentEditable: false,
          hasCodeBlocks: false,
          hasConversationFlow: false,
          hasSendButton: false,
          hasMarkdownRendering: false,
          hasAIRelatedMetadata: false,
          hasMessageRoles: false,
          hasStreamingIndicator: false,
        },
      }
      this.currentAdapter = this.createGenericAdapter(fallbackResult)
      return {
        adapter: this.currentAdapter,
        result: fallbackResult,
        needsConfirmation: false,
      }
    }

    return {
      adapter: null,
      result: detectionResult,
      needsConfirmation: detectionResult.confidence > 0.2,
    }
  }

  private createGenericAdapter(detectionResult: DetectionResult): PlatformAdapter {
    return {
      name: 'generic-ai-' + getDomain(),
      detect: () => true,
      getConfidenceScore: () => detectionResult.confidence,
      extractMessages: () => this.genericExtractor.extract(),
      injectPrompt: async (prompt: string): Promise<void> => {
        await this.universalInjector.inject(prompt)
      },
      supportsStreaming: false,
      supportsMarkdown: true,
    }
  }

  getCurrentAdapter(): PlatformAdapter | null {
    return this.currentAdapter
  }
}
