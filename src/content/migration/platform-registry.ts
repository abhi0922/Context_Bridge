import { PlatformInfo } from '../../types'

export const PLATFORMS: PlatformInfo[] = [
  {
    name: 'chatgpt',
    label: 'ChatGPT',
    aliases: ['chatgpt', 'gpt', 'openai', 'chat gpt', 'chat-gpt', 'chat_gpt'],
    url: 'https://chatgpt.com',
    hostnames: ['chatgpt.com', 'chat.openai.com'],
  },
  {
    name: 'claude',
    label: 'Claude',
    aliases: ['claude', 'anthropic', 'claude ai', 'claude.ai'],
    url: 'https://claude.ai',
    hostnames: ['claude.ai'],
  },
  {
    name: 'gemini',
    label: 'Gemini',
    aliases: ['gemini', 'bard', 'google ai', 'googleai', 'gemini google'],
    url: 'https://gemini.google.com',
    hostnames: ['gemini.google.com'],
  },
  {
    name: 'perplexity',
    label: 'Perplexity',
    aliases: ['perplexity', 'pplx', 'perplexity ai'],
    url: 'https://www.perplexity.ai',
    hostnames: ['perplexity.ai'],
  },
  {
    name: 'grok',
    label: 'Grok',
    aliases: ['grok', 'xai', 'x ai', 'grok ai'],
    url: 'https://grok.com',
    hostnames: ['grok.com', 'x.ai'],
  },
  {
    name: 'poe',
    label: 'Poe',
    aliases: ['poe', 'poe ai', 'quora poe'],
    url: 'https://poe.com',
    hostnames: ['poe.com'],
  },
  {
    name: 'deepseek',
    label: 'DeepSeek',
    aliases: ['deepseek', 'deep seek', 'deepseek ai', 'deepseek-chat'],
    url: 'https://chat.deepseek.com',
    hostnames: ['chat.deepseek.com', 'deepseek.com'],
  },
  {
    name: 'openrouter',
    label: 'OpenRouter',
    aliases: ['openrouter', 'open router', 'or'],
    url: 'https://openrouter.ai',
    hostnames: ['openrouter.ai'],
  },
  {
    name: 'cursor',
    label: 'Cursor',
    aliases: ['cursor', 'cursor ai', 'cursor.sh'],
    url: 'https://cursor.com',
    hostnames: ['cursor.com', 'cursor.sh'],
  },
  {
    name: 'lovable',
    label: 'Lovable',
    aliases: ['lovable', 'lovable dev', 'lovable.dev'],
    url: 'https://lovable.dev',
    hostnames: ['lovable.dev'],
  },
  {
    name: 'bolt',
    label: 'Bolt.new',
    aliases: ['bolt', 'bolt.new', 'bolt new', 'bolt dot new'],
    url: 'https://bolt.new',
    hostnames: ['bolt.new'],
  },
  {
    name: 'v0',
    label: 'v0',
    aliases: ['v0', 'v0 dev', 'vzero', 'v zero'],
    url: 'https://v0.dev',
    hostnames: ['v0.dev'],
  },
  {
    name: 'windsurf',
    label: 'Windsurf',
    aliases: ['windsurf', 'codeium', 'windsurf ai'],
    url: 'https://windsurf.com',
    hostnames: ['windsurf.com', 'codeium.com'],
  },
]

export function findPlatformByName(name: string): PlatformInfo | undefined {
  return PLATFORMS.find(p => p.name === name)
}

export function findPlatformByHostname(): PlatformInfo | undefined {
  const hostname = window.location.hostname
  return PLATFORMS.find(p => p.hostnames.some(h => hostname.includes(h)))
}

export function getSupportedNames(): string[] {
  return PLATFORMS.map(p => p.name)
}

export function getSupportedLabels(): string[] {
  return PLATFORMS.map(p => p.label)
}
