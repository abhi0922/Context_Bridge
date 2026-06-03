export interface Message {
  role: 'user' | 'assistant' | 'system'
  content: string
  id?: string
  timestamp?: number
}

export interface PlatformAdapter {
  name: string
  detect(): boolean
  getConfidenceScore(): number
  extractMessages(): Message[]
  injectPrompt(prompt: string): Promise<void>
  supportsStreaming?: boolean
  supportsMarkdown?: boolean
}

export interface DetectionSignals {
  hasTextarea: boolean
  hasContentEditable: boolean
  hasCodeBlocks: boolean
  hasConversationFlow: boolean
  hasSendButton: boolean
  hasMarkdownRendering: boolean
  hasAIRelatedMetadata: boolean
  hasMessageRoles: boolean
  hasStreamingIndicator: boolean
}

export interface DetectionResult {
  isAIChat: boolean
  confidence: number
  signals: DetectionSignals
  platform?: string
}

export interface TrustedDomain {
  domain: string
  allowAlways: boolean
  timestamp: number
}

export interface AdapterConfig {
  name: string
  hostnames: string[]
  selectors: Record<string, string>
}

export interface ExtractedMessage {
  element: Element
  role: 'user' | 'assistant' | 'unknown'
  content: string
}

export type UserConfirmation = 'allow_once' | 'allow_always' | 'deny'

export interface PlatformInfo {
  name: string
  label: string
  aliases: string[]
  url: string
  hostnames: string[]
}

export interface MigrationRequest {
  destination: string
  sourcePlatform: string
  prompt: string
  tabId?: number
}

export interface MigrationStatus {
  phase: 'extracting' | 'creating_prompt' | 'opening_tab' | 'injecting' | 'complete' | 'error'
  message: string
  error?: string
}

export interface RecentMigration {
  destination: string
  timestamp: number
  sourcePlatform: string
}

export interface GroqConfig {
  model: string
  temperature: number
  maxTokens: number
  timeout: number
}

export interface GroqMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GroqChoice {
  index: number
  message: {
    role: string
    content: string
  }
  finish_reason: string
}

export interface GroqResponse {
  id: string
  object: string
  created: number
  model: string
  choices: GroqChoice[]
  usage: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export interface GroqErrorResponse {
  error: {
    message: string
    type: string
    code: string
  }
}

export interface SummarizedMemory {
  projectGoal: string
  currentTask: string
  techStack: string[]
  architectureDecisions: string[]
  pendingTasks: string[]
  recentProgress: string[]
  importantContext: string[]
  userIntent: string
  conventions: string[]
}

export interface SummarizationResult {
  success: boolean
  memory?: SummarizedMemory
  summary?: string
  originalTokenCount: number
  compressedTokenCount: number
  model: string
  error?: string
  raw: string
}

export interface GroqSettings {
  model: string
  autoSummarize: boolean
  tokenLimit: number
  temperature: number
}

export const DEFAULT_GROQ_CONFIG: GroqConfig = {
  model: 'llama-3.3-70b-versatile',
  temperature: 0.3,
  maxTokens: 4096,
  timeout: 30000,
}

export const DEFAULT_GROQ_SETTINGS: GroqSettings = {
  model: 'llama-3.3-70b-versatile',
  autoSummarize: true,
  tokenLimit: 8000,
  temperature: 0.3,
}

export const BLOCKED_DOMAINS = [
  'bank', 'banking', 'paypal', 'chase', 'wellsfargo', 'bankofamerica',
  'mail.google.com', 'outlook.live.com', 'mail.yahoo.com',
  'login.gov', 'usa.gov', 'irs.gov',
  'password', 'passwords',
]

export const AI_KEYWORDS = [
  'chat', 'ai', 'gpt', 'claude', 'gemini', 'llm', 'assistant',
  'copilot', 'chatbot', 'conversation', 'neural', 'openai',
  'anthropic', 'perplexity', 'grok', 'deepseek', 'poe',
  'cursor', 'windsurf', 'lovable', 'bolt', 'v0',
]

export type EditorType = 'textarea' | 'contenteditable' | 'prosemirror' | 'lexical' | 'slate' | 'quill' | 'draftjs' | 'monaco' | 'custom'

export interface EditorCandidate {
  element: HTMLElement
  score: number
  selector: string
  type: EditorType
  reason: string
}

export type InjectionStrategyName = 'execCommand' | 'selectionRange' | 'nativeValue' | 'innerText' | 'clipboardPaste' | 'none'

export interface InjectionAttempt {
  strategy: InjectionStrategyName
  success: boolean
  error?: string
}

export interface InjectionResult {
  success: boolean
  strategy: InjectionStrategyName
  attempts: InjectionAttempt[]
  editorSelector: string
  editorType: EditorType
  verified: boolean
}

export interface PlatformMemoryEntry {
  hostname: string
  editorSelector: string
  editorType: EditorType
  strategy: InjectionStrategyName
  successCount: number
  lastUsed: number
}

export type DiscoverySignal =
  | 'focused'
  | 'hasRoleTextbox'
  | 'isContentEditable'
  | 'nearSendButton'
  | 'largeSize'
  | 'hasPlaceholder'
  | 'hasAriaMultiline'
  | 'isProseMirror'
  | 'isQuill'
  | 'isLexical'
  | 'isSlate'
  | 'inMainContent'
  | 'inForm'
  | 'isSearchInput'
  | 'tooSmall'
  | 'inLoginForm'
  | 'hidden'
  | 'disabled'
