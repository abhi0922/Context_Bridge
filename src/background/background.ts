import { SummarizationResult } from '../types'
import { BLOCKED_DOMAINS } from '../types'
import { PLATFORMS, findPlatformByName } from '../content/migration/platform-registry'
import { matchDestination } from '../content/migration/fuzzy-matcher'
import { storeMigrationPrompt, clearMigrationPrompt, addRecentMigration } from '../utils/storage'
import {
  saveGroqApiKey,
  removeGroqApiKey,
  hasGroqApiKey,
} from '../utils/storage'
import { summarizeConversation } from '../ai/summarizer'
import { buildMigrationPrompt } from '../ai/promptBuilder'
import { getCompressionRatio } from '../ai/tokenManager'
import { generateMigrationPrompt } from '../content/migration/prompt-generator'

const MSG_TIMEOUT = 15000

function debugLog(...args: unknown[]) {
  console.log('[Context Bridge][Background]', ...args)
}

chrome.runtime.onInstalled.addListener(() => {
  debugLog('v3 installed. Groq AI summarization ready.')
})

chrome.runtime.onMessage.addListener((
  message: { action: string; destination?: string; prompt?: string; apiKey?: string; settings?: unknown },
  sender: chrome.runtime.MessageSender,
  sendResponse: (response?: unknown) => void
) => {
  switch (message.action) {
    case 'getStatus':
      handleGetStatus(sendResponse)
      break
    case 'matchDestination':
      handleMatchDestination(message.destination || '', sendResponse)
      break
    case 'migrate':
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tabId = tabs[0]?.id
        handleMigrate(message.destination || '', tabId, sendResponse)
      })
      break
    case 'summarizeAndMigrate':
      chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tabId = tabs[0]?.id
        handleSummarizeAndMigrate(message.destination || '', tabId, sendResponse)
      })
      break
    case 'extract':
      handleExtract(sendResponse)
      break
    case 'inject':
      handleInject(message.prompt || '', sendResponse)
      break
    case 'getGroqKeyStatus':
      handleGetGroqKeyStatus(sendResponse)
      break
    case 'saveGroqKey':
      handleSaveGroqKey(message.apiKey || '', sendResponse)
      break
    case 'removeGroqKey':
      handleRemoveGroqKey(sendResponse)
      break
    default:
      sendResponse({ error: 'Unknown action' })
  }
  return true
})

function handleGetStatus(sendResponse: (response?: unknown) => void): void {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0]
    if (!tab?.id) {
      sendResponse({ active: false, error: 'No active tab' })
      return
    }

    chrome.tabs.sendMessage(tab.id, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ active: false, error: chrome.runtime.lastError.message })
      } else {
        const resp = response as { platform?: string } | undefined
        sendResponse({ active: true, platform: resp?.platform || 'unknown' })
      }
    })
  })
}

function handleMatchDestination(input: string, sendResponse: (response?: unknown) => void): void {
  const result = matchDestination(input)
  if (result) {
    sendResponse({
      matched: true,
      platform: result.platform,
      score: result.score,
      matchType: result.matchType,
    })
  } else {
    sendResponse({ matched: false })
  }
}

function handleGetGroqKeyStatus(sendResponse: (response?: unknown) => void): void {
  hasGroqApiKey().then(hasKey => {
    sendResponse({ hasKey })
  })
}

function handleSaveGroqKey(apiKey: string, sendResponse: (response?: unknown) => void): void {
  if (!apiKey || !apiKey.startsWith('gsk_')) {
    sendResponse({ success: false, error: 'Invalid API key format. Must start with "gsk_".' })
    return
  }

  saveGroqApiKey(apiKey).then(() => {
    console.log('[Context Bridge] Groq API key saved securely')
    sendResponse({ success: true })
  }).catch(err => {
    sendResponse({ success: false, error: String(err) })
  })
}

function handleRemoveGroqKey(sendResponse: (response?: unknown) => void): void {
  removeGroqApiKey().then(() => {
    console.log('[Context Bridge] Groq API key removed')
    sendResponse({ success: true })
  }).catch(err => {
    sendResponse({ success: false, error: String(err) })
  })
}

async function handleMigrate(
  destination: string,
  sourceTabId: number | undefined,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  if (!sourceTabId) {
    sendResponse({ error: 'No source tab' })
    return
  }

  const match = matchDestination(destination)
  if (!match) {
    sendResponse({ error: `Unknown destination: ${destination}` })
    return
  }

  const targetPlatform = match.platform

  try {
    const messages = await extractFromTab(sourceTabId)
    if (messages.length === 0) {
      sendResponse({ error: 'No messages to migrate' })
      return
    }

    const sourcePlatform = await getPlatformName(sourceTabId)
    const prompt = generateMigrationPrompt(messages, sourcePlatform, targetPlatform.name)

    await storeMigrationPrompt(prompt)

    const tab = await chrome.tabs.create({ url: targetPlatform.url, active: true })

    await addRecentMigration(targetPlatform.name, sourcePlatform)

    waitForTabAndInject(tab.id!, targetPlatform.name, prompt)

    sendResponse({
      success: true,
      sourcePlatform,
      destination: targetPlatform.name,
      promptLength: prompt.length,
      messageCount: messages.length,
      tabId: tab.id,
      method: 'raw',
    })
  } catch (err) {
    sendResponse({ error: String(err) })
  }
}

async function handleSummarizeAndMigrate(
  destination: string,
  sourceTabId: number | undefined,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  if (!sourceTabId) {
    sendResponse({ error: 'No source tab' })
    return
  }

  const match = matchDestination(destination)
  if (!match) {
    sendResponse({ error: `Unknown destination: ${destination}` })
    return
  }

  const targetPlatform = match.platform

  try {
    const messages = await extractFromTab(sourceTabId)
    if (messages.length === 0) {
      sendResponse({ error: 'No messages to migrate' })
      return
    }

    const sourcePlatform = await getPlatformName(sourceTabId)

    let result: SummarizationResult
    try {
      result = await summarizeConversation(messages)
    } catch {
      result = {
        success: false,
        error: 'Summarization failed',
        originalTokenCount: 0,
        compressedTokenCount: 0,
        model: 'none',
        raw: '',
      }
    }

    if (!result.success) {
      sendResponse({
        error: `Summarization failed: ${result.error}`,
        needsFallback: true,
        sourcePlatform,
        destination: targetPlatform.name,
        messageCount: messages.length,
      })
      return
    }

    let prompt: string
    if (result.memory) {
      prompt = buildMigrationPrompt(result.memory)
    } else {
      prompt = generateMigrationPrompt(messages, sourcePlatform, targetPlatform.name)
    }

    await storeMigrationPrompt(prompt)

    const tab = await chrome.tabs.create({ url: targetPlatform.url, active: true })

    await addRecentMigration(targetPlatform.name, sourcePlatform)

    waitForTabAndInject(tab.id!, targetPlatform.name, prompt)

    const compressionRatio = getCompressionRatio(result.originalTokenCount, result.compressedTokenCount)

    sendResponse({
      success: true,
      sourcePlatform,
      destination: targetPlatform.name,
      promptLength: prompt.length,
      messageCount: messages.length,
      tabId: tab.id,
      method: 'groq_summarized',
      summarization: {
        originalTokens: result.originalTokenCount,
        compressedTokens: result.compressedTokenCount,
        compressionRatio,
        model: result.model,
      },
    })
  } catch (err) {
    sendResponse({ error: String(err) })
  }
}

async function waitForTabAndInject(tabId: number, platformName: string, prompt: string): Promise<void> {
  const MAX_WAIT = 30000
  const startTime = Date.now()

  const listener = async (changedTabId: number, changeInfo: { status?: string }) => {
    if (changedTabId !== tabId) return
    if (changeInfo.status !== 'complete') return

    const elapsed = Date.now() - startTime
    if (elapsed > MAX_WAIT) {
      chrome.tabs.onUpdated.removeListener(listener)
      return
    }

    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tabId, {
          action: 'inject-migration',
          prompt,
          platform: platformName,
        })
      } catch {
        console.warn('[Context Bridge] Content script not ready, retrying...')
        setTimeout(async () => {
          try {
            await chrome.tabs.sendMessage(tabId, {
              action: 'inject-migration',
              prompt,
              platform: platformName,
            })
          } catch (e) {
            console.error('[Context Bridge] Failed to inject after retry:', e)
          }
        }, 2000)
      }
    }, 1000)

    chrome.tabs.onUpdated.removeListener(listener)
  }

  chrome.tabs.onUpdated.addListener(listener)

  setTimeout(() => {
    chrome.tabs.onUpdated.removeListener(listener)
  }, MAX_WAIT)
}

function extractFromTab(tabId: number): Promise<import('../types').Message[]> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { action: 'extract' }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message))
        return
      }
      const resp = response as { messages?: import('../types').Message[]; error?: string }
      if (resp.error) {
        reject(new Error(resp.error))
      } else {
        resolve(resp.messages || [])
      }
    })
  })
}

function getPlatformName(tabId: number): Promise<string> {
  return new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { action: 'ping' }, (response) => {
      if (chrome.runtime.lastError) {
        resolve('unknown')
      } else {
        const resp = response as { platform?: string } | undefined
        resolve(resp?.platform || 'unknown')
      }
    })
  })
}

function handleExtract(sendResponse: (response?: unknown) => void): void {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0]
    if (!tab?.id) {
      sendResponse({ error: 'No active tab' })
      return
    }

    chrome.tabs.sendMessage(tab.id, { action: 'extract' }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message })
      } else {
        sendResponse(response)
      }
    })
  })
}

function handleInject(prompt: string, sendResponse: (response?: unknown) => void): void {
  chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
    const tab = tabs[0]
    if (!tab?.id) {
      sendResponse({ error: 'No active tab' })
      return
    }

    chrome.tabs.sendMessage(tab.id, { action: 'inject', prompt }, (response) => {
      if (chrome.runtime.lastError) {
        sendResponse({ error: chrome.runtime.lastError.message })
      } else {
        sendResponse(response)
      }
    })
  })
}
