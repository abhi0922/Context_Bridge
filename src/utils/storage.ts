import { TrustedDomain, RecentMigration, GroqSettings, DEFAULT_GROQ_SETTINGS } from '../types'

const STORAGE_KEYS = {
  TRUSTED_DOMAINS: 'context_bridge_trusted_domains',
  DISABLED_DOMAINS: 'context_bridge_disabled_domains',
  ENABLED: 'context_bridge_enabled',
  MIGRATION_PENDING: 'context_bridge_migration_pending',
  RECENT_MIGRATIONS: 'context_bridge_recent_migrations',
  GROQ_API_KEY: 'context_bridge_groq_api_key',
  GROQ_SETTINGS: 'context_bridge_groq_settings',
}

export async function getTrustedDomains(): Promise<TrustedDomain[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.TRUSTED_DOMAINS)
  const data = result[STORAGE_KEYS.TRUSTED_DOMAINS]
  return Array.isArray(data) ? data : []
}

export async function addTrustedDomain(domain: string, always: boolean): Promise<void> {
  const domains = await getTrustedDomains()
  domains.push({ domain, allowAlways: always, timestamp: Date.now() })
  await chrome.storage.local.set({ [STORAGE_KEYS.TRUSTED_DOMAINS]: domains })
}

export async function isDomainTrusted(domain: string): Promise<boolean> {
  const domains = await getTrustedDomains()
  return domains.some(d => d.domain === domain)
}

export async function isDomainAlwaysTrusted(domain: string): Promise<boolean> {
  const domains = await getTrustedDomains()
  return domains.some(d => d.domain === domain && d.allowAlways)
}

export async function getDisabledDomains(): Promise<string[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.DISABLED_DOMAINS)
  const data = result[STORAGE_KEYS.DISABLED_DOMAINS]
  return Array.isArray(data) ? data : []
}

export async function addDisabledDomain(domain: string): Promise<void> {
  const domains = await getDisabledDomains()
  if (!domains.includes(domain)) {
    domains.push(domain)
    await chrome.storage.local.set({ [STORAGE_KEYS.DISABLED_DOMAINS]: domains })
  }
}

export async function isDomainDisabled(domain: string): Promise<boolean> {
  const domains = await getDisabledDomains()
  return domains.includes(domain)
}

export async function isExtensionEnabled(): Promise<boolean> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.ENABLED)
  const val = result[STORAGE_KEYS.ENABLED]
  return val !== false
}

export async function setExtensionEnabled(enabled: boolean): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.ENABLED]: enabled })
}

export async function storeMigrationPrompt(prompt: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.MIGRATION_PENDING]: {
      prompt,
      timestamp: Date.now(),
    },
  })
}

export async function getMigrationPrompt(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.MIGRATION_PENDING)
  const data = result[STORAGE_KEYS.MIGRATION_PENDING] as { prompt?: string; timestamp?: number } | undefined
  if (!data) return null
  const age = Date.now() - (data.timestamp || 0)
  if (age > 120000) {
    await chrome.storage.local.remove(STORAGE_KEYS.MIGRATION_PENDING)
    return null
  }
  return data.prompt || null
}

export async function clearMigrationPrompt(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.MIGRATION_PENDING)
}

export async function getRecentMigrations(): Promise<RecentMigration[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.RECENT_MIGRATIONS)
  const data = result[STORAGE_KEYS.RECENT_MIGRATIONS]
  return Array.isArray(data) ? data : []
}

export async function addRecentMigration(destination: string, sourcePlatform: string): Promise<void> {
  const migrations = await getRecentMigrations()
  migrations.unshift({ destination, sourcePlatform, timestamp: Date.now() })
  if (migrations.length > 10) migrations.pop()
  await chrome.storage.local.set({ [STORAGE_KEYS.RECENT_MIGRATIONS]: migrations })
}

export async function getGroqApiKey(): Promise<string | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.GROQ_API_KEY)
  return (result[STORAGE_KEYS.GROQ_API_KEY] as string) || null
}

export async function saveGroqApiKey(key: string): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.GROQ_API_KEY]: key })
}

export async function removeGroqApiKey(): Promise<void> {
  await chrome.storage.local.remove(STORAGE_KEYS.GROQ_API_KEY)
}

export async function hasGroqApiKey(): Promise<boolean> {
  const key = await getGroqApiKey()
  return key !== null && key.length > 0
}

export async function getGroqSettings(): Promise<GroqSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.GROQ_SETTINGS)
  return (result[STORAGE_KEYS.GROQ_SETTINGS] as GroqSettings) || DEFAULT_GROQ_SETTINGS
}

export async function saveGroqSettings(settings: GroqSettings): Promise<void> {
  await chrome.storage.local.set({ [STORAGE_KEYS.GROQ_SETTINGS]: settings })
}
