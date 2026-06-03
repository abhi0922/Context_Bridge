export interface Injector {
  name: string
  inject(prompt: string): Promise<void>
}

import { UniversalInjector } from '../injection/universal-injector'
import { injectGemini } from './gemini'
import { injectGeneric } from './generic'

type InjectorFn = (prompt: string) => Promise<void>

const injectorMap: Record<string, InjectorFn> = {
  gemini: injectGemini,
}

export async function injectPromptForPlatform(
  prompt: string,
  platform: string
): Promise<string> {
  const injector = injectorMap[platform]
  if (injector) {
    console.log(`[Context Bridge] Using dedicated injector for: ${platform}`)
    await injector(prompt)
    return 'dedicated'
  }

  console.log(`[Context Bridge] Using universal injector for: ${platform}`)
  const universal = new UniversalInjector()
  const result = await universal.inject(prompt)
  if (result.success && result.verified) return 'universal'

  console.log('[Context Bridge] Universal injector failed, using generic fallback')
  await injectGeneric(prompt)
  return 'generic'
}
