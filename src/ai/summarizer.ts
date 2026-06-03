import { Message, SummarizedMemory, SummarizationResult, GroqConfig } from '../types'
import { callGroq, GroqClientError } from './groqClient'
import { estimateTokens, truncateMessages } from './tokenManager'
import { buildSummarizationPrompt } from './promptBuilder'
import { getGroqApiKey, getGroqSettings } from '../utils/storage'

function parseSummarizedMemory(raw: string): SummarizedMemory {
  const lines = raw.split('\n')
  const memory: SummarizedMemory = {
    projectGoal: '',
    currentTask: '',
    techStack: [],
    architectureDecisions: [],
    pendingTasks: [],
    recentProgress: [],
    importantContext: [],
    userIntent: '',
    conventions: [],
  }

  let currentSection = ''

  for (const line of lines) {
    const trimmed = line.trim()
    const sectionMatch = trimmed.match(/^\[([A-Z_]+)\]\s*(.*)/)
    if (sectionMatch) {
      currentSection = sectionMatch[1]
      const rest = sectionMatch[2].trim()
      if (rest) addToSection(memory, currentSection, rest)
      continue
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      addToSection(memory, currentSection, trimmed.replace(/^[-*]\s*/, ''))
    } else if (trimmed && currentSection) {
      addToSection(memory, currentSection, trimmed)
    }
  }

  return memory
}

function addToSection(memory: SummarizedMemory, section: string, value: string): void {
  if (!value) return
  switch (section) {
    case 'PROJECT_GOAL':
      memory.projectGoal = memory.projectGoal ? `${memory.projectGoal} ${value}` : value
      break
    case 'CURRENT_TASK':
      memory.currentTask = memory.currentTask ? `${memory.currentTask} ${value}` : value
      break
    case 'TECH_STACK':
      if (!memory.techStack.includes(value)) memory.techStack.push(value)
      break
    case 'ARCHITECTURE_DECISIONS':
      if (!memory.architectureDecisions.includes(value)) memory.architectureDecisions.push(value)
      break
    case 'PENDING_TASKS':
      if (!memory.pendingTasks.includes(value)) memory.pendingTasks.push(value)
      break
    case 'RECENT_PROGRESS':
      if (!memory.recentProgress.includes(value)) memory.recentProgress.push(value)
      break
    case 'IMPORTANT_CONTEXT':
      if (!memory.importantContext.includes(value)) memory.importantContext.push(value)
      break
    case 'USER_INTENT':
      memory.userIntent = memory.userIntent ? `${memory.userIntent} ${value}` : value
      break
    case 'CONVENTIONS':
      if (!memory.conventions.includes(value)) memory.conventions.push(value)
      break
  }
}

export async function summarizeConversation(
  messages: Message[],
  apiKeyOverride?: string
): Promise<SummarizationResult> {
  const apiKey = apiKeyOverride || await getGroqApiKey()
  if (!apiKey) {
    return {
      success: false,
      error: 'No Groq API key configured',
      originalTokenCount: 0,
      compressedTokenCount: 0,
      model: 'none',
      raw: '',
    }
  }

  const settings = await getGroqSettings()
  const originalTokenCount = estimateTokens(messages.map(m => m.content).join(' '))
  const truncated = truncateMessages(messages, settings.tokenLimit)

  const config: Partial<GroqConfig> = {
    model: settings.model,
    temperature: settings.temperature,
  }

  const formattedMessages = buildSummarizationPrompt(truncated)

  try {
    const response = await callGroq(apiKey, formattedMessages, config)

    const raw = response.choices[0]?.message?.content || ''
    const compressedTokenCount = response.usage?.total_tokens || estimateTokens(raw)
    const memory = parseSummarizedMemory(raw)

    return {
      success: true,
      memory,
      summary: raw,
      originalTokenCount,
      compressedTokenCount,
      model: response.model || settings.model,
      raw,
    }
  } catch (err) {
    const errorMessage = err instanceof GroqClientError
      ? `${err.code}: ${err.message}`
      : err instanceof Error ? err.message : 'Unknown error'

    return {
      success: false,
      error: errorMessage,
      originalTokenCount,
      compressedTokenCount: 0,
      model: settings.model,
      raw: '',
    }
  }
}
