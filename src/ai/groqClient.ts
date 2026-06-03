import { GroqConfig, GroqMessage, GroqResponse, GroqErrorResponse, DEFAULT_GROQ_CONFIG } from '../types'

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions'

export class GroqClientError extends Error {
  constructor(
    message: string,
    public code: 'INVALID_KEY' | 'RATE_LIMIT' | 'TIMEOUT' | 'API_ERROR' | 'NETWORK_ERROR',
    public status?: number
  ) {
    super(message)
    this.name = 'GroqClientError'
  }
}

export async function callGroq(
  apiKey: string,
  messages: GroqMessage[],
  config: Partial<GroqConfig> = {}
): Promise<GroqResponse> {
  const mergedConfig = { ...DEFAULT_GROQ_CONFIG, ...config }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), mergedConfig.timeout)

  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: mergedConfig.model,
        messages,
        temperature: mergedConfig.temperature,
        max_tokens: mergedConfig.maxTokens,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({})) as GroqErrorResponse
      const errorMsg = errorBody.error?.message || `HTTP ${response.status}`

      switch (response.status) {
        case 401:
          throw new GroqClientError('Invalid API key', 'INVALID_KEY', response.status)
        case 429:
          throw new GroqClientError('Rate limit exceeded', 'RATE_LIMIT', response.status)
        case 500:
        case 502:
        case 503:
          throw new GroqClientError(`Groq API error: ${errorMsg}`, 'API_ERROR', response.status)
        default:
          throw new GroqClientError(errorMsg, 'API_ERROR', response.status)
      }
    }

    const data = await response.json() as GroqResponse
    return data
  } catch (err) {
    clearTimeout(timeoutId)

    if (err instanceof GroqClientError) throw err

    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new GroqClientError('Request timed out', 'TIMEOUT')
    }

    throw new GroqClientError(
      err instanceof Error ? err.message : 'Network error',
      'NETWORK_ERROR'
    )
  }
}

export async function validateGroqKey(apiKey: string): Promise<boolean> {
  try {
    const response = await fetch(GROQ_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: DEFAULT_GROQ_CONFIG.model,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: AbortSignal.timeout(10000),
    })
    return response.ok
  } catch {
    return false
  }
}
