import { isExtensionEnabled, setExtensionEnabled, getRecentMigrations } from '../utils/storage'
import { getGroqApiKey, hasGroqApiKey, getGroqSettings, saveGroqSettings, removeGroqApiKey } from '../utils/storage'
import { GroqSettings } from '../types'

document.addEventListener('DOMContentLoaded', async () => {
  const statusBadge = document.getElementById('status-badge')!
  const groqBadge = document.getElementById('groq-badge')!
  const sourcePlatform = document.getElementById('source-platform')!
  const toggleEnabled = document.getElementById('toggle-enabled') as HTMLInputElement
  const destinationInput = document.getElementById('destination-input') as HTMLInputElement
  const btnContinue = document.getElementById('btn-continue') as HTMLButtonElement
  const matchInfo = document.getElementById('match-info')!
  const matchLabel = document.getElementById('match-label')!
  const statusSection = document.getElementById('status-section')!
  const statusMessage = document.getElementById('status-message')!
  const progressBar = document.getElementById('progress-bar')!
  const recentSection = document.getElementById('recent-section')!
  const recentList = document.getElementById('recent-list')!
  const outputSection = document.getElementById('output-section')!
  const outputText = document.getElementById('output-text') as HTMLTextAreaElement
  const fallbackSection = document.getElementById('fallback-section')!
  const btnFallbackYes = document.getElementById('btn-fallback-yes') as HTMLButtonElement
  const btnFallbackNo = document.getElementById('btn-fallback-no') as HTMLButtonElement
  const summarizationInfo = document.getElementById('summarization-info')!
  const summarizationStatus = document.getElementById('summarization-status')!
  const compressionRatio = document.getElementById('compression-ratio')!
  const summarizationModel = document.getElementById('summarization-model')!

  const btnSettings = document.getElementById('btn-settings') as HTMLButtonElement
  const settingsPanel = document.getElementById('settings-panel')!
  const btnCloseSettings = document.getElementById('btn-close-settings') as HTMLButtonElement
  const keyStatusIndicator = document.getElementById('key-status-indicator')!
  const keyStatusText = document.getElementById('key-status-text')!
  const btnUpdateKey = document.getElementById('btn-update-key') as HTMLButtonElement
  const btnRemoveKey = document.getElementById('btn-remove-key') as HTMLButtonElement
  const settingsModel = document.getElementById('settings-model') as HTMLSelectElement
  const settingsAutoSummarize = document.getElementById('settings-autosummarize') as HTMLInputElement
  const settingsTokenLimit = document.getElementById('settings-tokenlimit') as HTMLSelectElement
  const settingsTemperature = document.getElementById('settings-temperature') as HTMLInputElement
  const temperatureValue = document.getElementById('temperature-value')!

  const apiKeyModal = document.getElementById('api-key-modal')!
  const apiKeyInput = document.getElementById('api-key-input') as HTMLInputElement
  const apiKeyError = document.getElementById('api-key-error')!
  const btnSaveKey = document.getElementById('btn-save-key') as HTMLButtonElement
  const btnCancelKey = document.getElementById('btn-cancel-key') as HTMLButtonElement

  let currentPlatform = 'unknown'
  let matchedPlatform: { name: string; label: string } | null = null
  let migrationInProgress = false
  let pendingFallback: { destination: string; sourcePlatform: string; messages: unknown[] } | null = null

  const enabled = await isExtensionEnabled()
  toggleEnabled.checked = enabled
  if (!enabled) {
    statusBadge.textContent = 'Disabled'
    destinationInput.disabled = true
    return
  }

  await updateGroqBadge()

  const hasKey = await hasGroqApiKey()
  if (!hasKey) {
    setTimeout(() => {
      apiKeyModal.classList.remove('hidden')
      apiKeyInput.focus()
    }, 500)
  }

  chrome.runtime.sendMessage({ action: 'getStatus' }, (response) => {
    if (response?.active) {
      statusBadge.textContent = 'Active'
      statusBadge.classList.add('active')
      currentPlatform = response.platform || 'unknown'
      sourcePlatform.textContent = formatPlatform(currentPlatform)
    } else {
      statusBadge.textContent = 'Inactive'
      sourcePlatform.textContent = 'Not detected'
      destinationInput.disabled = true
      btnContinue.disabled = true
    }
  })

  const recentMigrations = await getRecentMigrations()
  if (recentMigrations.length > 0) {
    recentSection.classList.remove('hidden')
    const seen = new Set<string>()
    recentMigrations.forEach(m => {
      if (seen.has(m.destination)) return
      seen.add(m.destination)
      const chip = document.createElement('span')
      chip.className = 'recent-chip'
      chip.textContent = formatPlatform(m.destination)
      chip.addEventListener('click', () => {
        destinationInput.value = m.destination
        destinationInput.dispatchEvent(new Event('input'))
      })
      recentList.appendChild(chip)
    })
  }

  toggleEnabled.addEventListener('change', async () => {
    await setExtensionEnabled(toggleEnabled.checked)
    if (!toggleEnabled.checked) {
      statusBadge.textContent = 'Disabled'
      statusBadge.classList.remove('active')
      destinationInput.disabled = true
      btnContinue.disabled = true
    } else {
      statusBadge.textContent = 'Inactive'
      destinationInput.disabled = false
    }
  })

  let debounceTimer: ReturnType<typeof setTimeout>
  destinationInput.addEventListener('input', () => {
    clearTimeout(debounceTimer)
    const input = destinationInput.value.trim()

    if (!input) {
      matchInfo.classList.add('hidden')
      btnContinue.disabled = true
      matchedPlatform = null
      return
    }

    debounceTimer = setTimeout(() => {
      chrome.runtime.sendMessage({ action: 'matchDestination', destination: input }, (response) => {
        if (response?.matched) {
          const p = response.platform as { name: string; label: string }
          matchedPlatform = p
          matchLabel.textContent = `${response.matchType === 'exact' ? '\u2713' : '~'} ${formatPlatform(p.name)}`
          matchInfo.classList.remove('hidden')
          btnContinue.disabled = currentPlatform === p.name
          if (currentPlatform === p.name) {
            matchLabel.textContent += ' (already here)'
          }
        } else {
          matchedPlatform = null
          matchLabel.textContent = 'Unknown platform'
          matchInfo.classList.remove('hidden')
          btnContinue.disabled = true
        }
      })
    }, 200)
  })

  destinationInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !btnContinue.disabled && !migrationInProgress) {
      startMigration()
    }
  })

  btnContinue.addEventListener('click', startMigration)

  async function startMigration(): Promise<void> {
    if (!matchedPlatform || migrationInProgress) return

    migrationInProgress = true
    btnContinue.disabled = true
    btnContinue.textContent = 'Migrating...'
    matchInfo.classList.add('hidden')
    fallbackSection.classList.add('hidden')
    summarizationInfo.classList.add('hidden')
    pendingFallback = null
    showStatus('Extracting conversation...', false)
    progressBar.classList.remove('hidden')

    const hasKey = await hasGroqApiKey()
    const settings = await getGroqSettings()

    if (hasKey && settings.autoSummarize) {
      showStatus('Summarizing with Groq AI...', false)
      chrome.runtime.sendMessage(
        { action: 'summarizeAndMigrate', destination: matchedPlatform.name },
        handleMigrationResponse
      )
    } else {
      if (!hasKey) {
        showStatus('No Groq API key — sending raw conversation', false)
      } else {
        showStatus('Auto-summarize is off — sending raw conversation', false)
      }
      chrome.runtime.sendMessage(
        { action: 'migrate', destination: matchedPlatform.name },
        handleMigrationResponse
      )
    }

    function handleMigrationResponse(response: {
      error?: string
      needsFallback?: boolean
      sourcePlatform?: string
      destination?: string
      messageCount?: number
      promptLength?: number
      method?: string
      summarization?: {
        compressedTokens: number
        compressionRatio: number
        model: string
      }
    }): void {
      if (response?.error) {
        if (response.needsFallback) {
          pendingFallback = {
            destination: matchedPlatform!.name,
            sourcePlatform: response.sourcePlatform || '',
            messages: [],
          }
          fallbackSection.classList.remove('hidden')
          showStatus(`Summarization failed: ${response.error}`, true)
          progressBar.classList.add('hidden')
          btnContinue.textContent = 'Continue'
          btnContinue.disabled = false
          migrationInProgress = false
          return
        }

        showStatus(`Error: ${response.error}`, true)
        progressBar.classList.add('hidden')
        btnContinue.textContent = 'Continue'
        btnContinue.disabled = false
        migrationInProgress = false
        return
      }

      let statusMsg = `\u2713 Migrating to ${formatPlatform(response.destination || '')}`
      if (response.messageCount) {
        statusMsg += ` \u2014 ${response.messageCount} messages`
      }
      showStatus(statusMsg, false)
      progressBar.classList.add('hidden')
      btnContinue.textContent = 'Continue'
      btnContinue.disabled = true
      destinationInput.value = ''
      matchInfo.classList.add('hidden')

      if (response.summarization) {
        const s = response.summarization
        summarizationStatus.textContent = `\u2713 ${s.compressedTokens} tokens`
        compressionRatio.textContent = `${s.compressionRatio}% compression`
        summarizationModel.textContent = s.model.split('/').pop() || s.model
        summarizationInfo.classList.remove('hidden')
      }

      if (response.promptLength) {
        outputText.value = `Migration prompt generated (${response.promptLength} chars)\n${response.messageCount} messages\nMethod: ${response.method || 'raw'}\nOpened in new tab...`
        outputSection.classList.remove('hidden')
      }

      setTimeout(() => {
        window.close()
      }, 3000)
    }
  }

  btnFallbackYes.addEventListener('click', async () => {
    if (!pendingFallback) return
    fallbackSection.classList.add('hidden')
    migrationInProgress = true
    btnContinue.disabled = true
    btnContinue.textContent = 'Migrating (raw)...'
    showStatus('Sending raw conversation...', false)
    progressBar.classList.remove('hidden')

    chrome.runtime.sendMessage(
      { action: 'migrate', destination: pendingFallback.destination },
      (response) => {
        if (response?.error) {
          showStatus(`Error: ${response.error}`, true)
          progressBar.classList.add('hidden')
          btnContinue.textContent = 'Continue'
          btnContinue.disabled = false
          migrationInProgress = false
          return
        }

        showStatus(`\u2713 Migrated to ${formatPlatform(response.destination)} (raw)`, false)
        progressBar.classList.add('hidden')
        btnContinue.textContent = 'Continue'
        btnContinue.disabled = true
        destinationInput.value = ''
        matchInfo.classList.add('hidden')

        setTimeout(() => {
          window.close()
        }, 3000)
      }
    )
  })

  btnFallbackNo.addEventListener('click', () => {
    fallbackSection.classList.add('hidden')
    pendingFallback = null
    btnContinue.textContent = 'Continue'
    btnContinue.disabled = false
    migrationInProgress = false
  })

  btnSettings.addEventListener('click', () => {
    loadSettingsIntoUI()
    settingsPanel.classList.remove('hidden')
  })

  btnCloseSettings.addEventListener('click', () => {
    settingsPanel.classList.add('hidden')
  })

  btnUpdateKey.addEventListener('click', () => {
    settingsPanel.classList.add('hidden')
    apiKeyModal.classList.remove('hidden')
    apiKeyInput.value = ''
    apiKeyError.classList.add('hidden')
    apiKeyInput.focus()
  })

  btnRemoveKey.addEventListener('click', async () => {
    await removeGroqApiKey()
    await updateGroqBadge()
    updateKeyStatusUI()
  })

  async function loadSettingsIntoUI(): Promise<void> {
    const settings = await getGroqSettings()
    settingsModel.value = settings.model
    settingsAutoSummarize.checked = settings.autoSummarize
    settingsTokenLimit.value = String(settings.tokenLimit)
    settingsTemperature.value = String(settings.temperature)
    temperatureValue.textContent = String(settings.temperature)
    updateKeyStatusUI()
  }

  function updateKeyStatusUI(): void {
    hasGroqApiKey().then(hasKey => {
      keyStatusIndicator.className = 'key-dot ' + (hasKey ? 'key-dot-present' : 'key-dot-absent')
      keyStatusText.textContent = hasKey ? 'Connected' : 'Not configured'
      btnRemoveKey.disabled = !hasKey
    })
  }

  settingsModel.addEventListener('change', saveSettings)
  settingsAutoSummarize.addEventListener('change', saveSettings)
  settingsTokenLimit.addEventListener('change', saveSettings)
  settingsTemperature.addEventListener('input', () => {
    temperatureValue.textContent = settingsTemperature.value
    saveSettings()
  })

  async function saveSettings(): Promise<void> {
    const settings: GroqSettings = {
      model: settingsModel.value,
      autoSummarize: settingsAutoSummarize.checked,
      tokenLimit: parseInt(settingsTokenLimit.value, 10),
      temperature: parseFloat(settingsTemperature.value),
    }
    await saveGroqSettings(settings)
  }

  btnSaveKey.addEventListener('click', async () => {
    const key = apiKeyInput.value.trim()
    if (!key) {
      showApiKeyError('Please enter an API key')
      return
    }

    if (!key.startsWith('gsk_')) {
      showApiKeyError('Invalid key format. Must start with "gsk_".')
      return
    }

    btnSaveKey.disabled = true
    btnSaveKey.textContent = 'Validating...'

    try {
      const response = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` },
        signal: AbortSignal.timeout(10000),
      })

      if (!response.ok) {
        btnSaveKey.disabled = false
        btnSaveKey.textContent = 'Save Key'
        showApiKeyError('Invalid API key. Please check and try again.')
        return
      }

      chrome.runtime.sendMessage({ action: 'saveGroqKey', apiKey: key }, async (resp) => {
        btnSaveKey.disabled = false
        btnSaveKey.textContent = 'Save Key'

        if (resp?.success) {
          apiKeyModal.classList.add('hidden')
          await updateGroqBadge()
          updateKeyStatusUI()
        } else {
          showApiKeyError(resp?.error || 'Failed to save key')
        }
      })
    } catch {
      btnSaveKey.disabled = false
      btnSaveKey.textContent = 'Save Key'
      showApiKeyError('Could not validate key. Check your network connection.')
    }
  })

  btnCancelKey.addEventListener('click', () => {
    apiKeyModal.classList.add('hidden')
    apiKeyError.classList.add('hidden')
  })

  apiKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      btnSaveKey.click()
    }
  })

  apiKeyInput.addEventListener('input', () => {
    apiKeyError.classList.add('hidden')
  })

  function showApiKeyError(message: string): void {
    apiKeyError.textContent = message
    apiKeyError.classList.remove('hidden')
  }

  async function updateGroqBadge(): Promise<void> {
    const hasKey = await hasGroqApiKey()
    groqBadge.className = 'badge ' + (hasKey ? 'badge-connected' : 'badge-hidden')
    if (hasKey) {
      groqBadge.textContent = 'Groq'
    }
  }

  function showStatus(message: string, isError: boolean): void {
    statusSection.classList.remove('hidden')
    statusMessage.textContent = message
    statusMessage.className = 'status-message' + (isError ? ' error' : ' success')
  }

  function formatPlatform(name: string): string {
    const labels: Record<string, string> = {
      chatgpt: 'ChatGPT',
      claude: 'Claude',
      gemini: 'Gemini',
      perplexity: 'Perplexity',
      grok: 'Grok',
      poe: 'Poe',
      deepseek: 'DeepSeek',
      openrouter: 'OpenRouter',
      cursor: 'Cursor',
      lovable: 'Lovable',
      bolt: 'Bolt.new',
      v0: 'v0',
      windsurf: 'Windsurf',
      unknown: 'Unknown',
    }
    return labels[name] || name.charAt(0).toUpperCase() + name.slice(1)
  }
})
