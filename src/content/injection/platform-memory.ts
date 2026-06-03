import { PlatformMemoryEntry, EditorType, InjectionStrategyName } from '../../types'

const STORAGE_KEY = 'context_bridge_injection_memory'
const MAX_ENTRIES = 50

export class PlatformMemory {
  async getBestEntry(hostname: string): Promise<PlatformMemoryEntry | null> {
    const entries = await this.getAllEntries()
    const hostEntries = entries
      .filter(e => e.hostname === hostname)
      .sort((a, b) => b.successCount - a.successCount || b.lastUsed - a.lastUsed)
    return hostEntries[0] || null
  }

  async recordSuccess(
    hostname: string,
    editorSelector: string,
    editorType: EditorType,
    strategy: InjectionStrategyName
  ): Promise<void> {
    const entries = await this.getAllEntries()
    const existing = entries.find(
      e => e.hostname === hostname && e.editorSelector === editorSelector && e.strategy === strategy
    )

    if (existing) {
      existing.successCount++
      existing.lastUsed = Date.now()
    } else {
      entries.push({
        hostname,
        editorSelector,
        editorType,
        strategy,
        successCount: 1,
        lastUsed: Date.now(),
      })
    }

    entries.sort((a, b) => b.lastUsed - a.lastUsed)
    if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES

    await chrome.storage.local.set({ [STORAGE_KEY]: entries })
  }

  async recordFailure(
    hostname: string,
    editorSelector: string,
    strategy: InjectionStrategyName
  ): Promise<void> {
    const entries = await this.getAllEntries()
    const existing = entries.find(
      e => e.hostname === hostname && e.editorSelector === editorSelector && e.strategy === strategy
    )

    if (existing) {
      existing.successCount = Math.max(0, existing.successCount - 1)
      if (existing.successCount === 0) {
        const idx = entries.indexOf(existing)
        if (idx >= 0) entries.splice(idx, 1)
      }
      await chrome.storage.local.set({ [STORAGE_KEY]: entries })
    }
  }

  async clear(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEY)
  }

  private async getAllEntries(): Promise<PlatformMemoryEntry[]> {
    try {
      const result = await chrome.storage.local.get(STORAGE_KEY)
      return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : []
    } catch {
      return []
    }
  }
}
