import { PlatformInfo } from '../../types'
import { PLATFORMS } from './platform-registry'

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      const cost = a[j - 1] === b[i - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      )
    }
  }
  return matrix[b.length][a.length]
}

function similarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1
  return 1 - levenshteinDistance(a, b) / maxLen
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim()
}

export interface FuzzyMatchResult {
  platform: PlatformInfo
  score: number
  matchType: 'exact' | 'alias' | 'fuzzy'
}

export function matchDestination(input: string): FuzzyMatchResult | null {
  const normalized = normalize(input)
  if (!normalized) return null

  const candidates: FuzzyMatchResult[] = []
  const SIMILARITY_THRESHOLD = 0.5

  for (const platform of PLATFORMS) {
    const allNames = [platform.name, platform.label, ...platform.aliases]

    for (const name of allNames) {
      const normalizedName = normalize(name)

      if (normalizedName === normalized) {
        return { platform, score: 1, matchType: 'exact' }
      }

      if (normalizedName.includes(normalized) || normalized.includes(normalizedName)) {
        candidates.push({
          platform,
          score: 0.9,
          matchType: normalizedName.includes(normalized) ? 'alias' : 'fuzzy',
        })
        break
      }

      const sim = similarity(normalizedName, normalized)
      if (sim >= SIMILARITY_THRESHOLD) {
        candidates.push({ platform, score: sim, matchType: 'fuzzy' })
        break
      }
    }
  }

  if (candidates.length === 0) return null

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0]
}
