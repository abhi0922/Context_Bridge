import { Message } from '../../types'

export function generateMigrationPrompt(
  messages: Message[],
  sourcePlatform: string,
  destinationPlatform: string
): string {
  const userMessages = messages.filter(m => m.role === 'user')
  const assistantMessages = messages.filter(m => m.role === 'assistant')

  const lastUserMessage = userMessages[userMessages.length - 1]
  const lastAssistantMessage = assistantMessages[assistantMessages.length - 1]

  const recentMessages = messages.slice(-6)
  const conversationSummary = recentMessages
    .map(m => `[${m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System'}]\n${m.content}`)
    .join('\n\n---\n\n')

  const allText = messages.map(m => m.content).join(' ')
  const codeBlocks = extractCodeBlocks(allText)
  const techStack = inferTechStack(allText)
  const tasks = extractTasks(messages)

  const prompt = `You are continuing an existing project.

PROJECT CONTEXT:
${conversationSummary}

${techStack.length > 0 ? `TECH STACK:\n${techStack.join('\n')}\n\n` : ''}${tasks.completed.length > 0 ? `COMPLETED:\n${tasks.completed.map(t => `- ${t}`).join('\n')}\n\n` : ''}${tasks.pending.length > 0 ? `PENDING TASKS:\n${tasks.pending.map(t => `- ${t}`).join('\n')}\n\n` : ''}${codeBlocks.length > 0 ? `RELEVANT CODE:\n\`\`\`\n${codeBlocks.slice(0, 3).join('\n\n')}\n\`\`\`\n\n` : ''}
IMPORTANT CONSTRAINTS:
- Continue exactly from this state
- Do not re-explain concepts already covered
- Maintain the same code style and conventions
- Ask clarifying questions if needed

Continue exactly from this state.`

  return prompt
}

function extractCodeBlocks(text: string): string[] {
  const blocks: string[] = []
  const regex = /```[\s\S]*?```/g
  let match
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[0])
  }
  return blocks
}

function inferTechStack(text: string): string[] {
  const techKeywords: Record<string, string[]> = {
    'React': ['react', 'jsx', 'tsx', 'component', 'hook', 'usestate', 'useeffect'],
    'TypeScript': ['typescript', ': string', ': number', 'interface', 'type ', 'asnyc'],
    'Python': ['python', 'def ', 'import ', 'class ', 'self', 'pytest'],
    'Node.js': ['node', 'npm', 'require(', 'module.exports', 'express'],
    'Next.js': ['next', 'nextjs', 'getstaticprops', 'getserversideprops'],
    'Tailwind': ['tailwind', 'className=', 'class:', 'flex', 'grid', 'px-', 'py-', 'mx-'],
    'Docker': ['docker', 'dockerfile', 'docker-compose', 'container'],
    'PostgreSQL': ['postgres', 'postgresql', 'sql', 'database', 'table', 'query'],
    'Prisma': ['prisma', 'schema', 'model ', '@id', '@default'],
  }

  const detected: string[] = []
  const lower = text.toLowerCase()

  for (const [tech, keywords] of Object.entries(techKeywords)) {
    if (keywords.some(kw => lower.includes(kw))) {
      detected.push(tech)
    }
  }

  return detected
}

function extractTasks(messages: Message[]): { completed: string[]; pending: string[] } {
  const completed: string[] = []
  const pending: string[] = []

  const allText = messages.map(m => m.content).join('\n')
  const lines = allText.split('\n')

  for (const line of lines) {
    const lower = line.toLowerCase().trim()
    if (lower.startsWith('- [x]') || lower.startsWith('* [x]') || lower.includes('✅') || lower.includes('✔')) {
      completed.push(line.replace(/[-*]\s*\[x\]\s*/i, '').replace(/[✅✔]\s*/, '').trim())
    }
    if (lower.startsWith('- [ ]') || lower.startsWith('* [ ]') || lower.includes('todo:') || lower.includes('TODO:')) {
      pending.push(line.replace(/[-*]\s*\[ \]\s*/i, '').replace(/todo:\s*/i, '').trim())
    }
  }

  return { completed, pending }
}
