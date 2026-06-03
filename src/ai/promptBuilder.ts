import { Message, SummarizedMemory, GroqMessage } from '../types'

const SYSTEM_PROMPT = `You are generating portable AI project memory.

Extract and summarize the following conversation into structured project memory.

Cover:
- project goal (what is being built)
- current task (what is actively being worked on)
- tech stack (languages, frameworks, tools mentioned)
- architecture decisions (important design choices)
- pending issues or tasks (what remains to be done)
- coding conventions (style, patterns, preferences)
- latest progress (what was just accomplished)
- user intent (what the user ultimately wants)

Format your response as:
[PROJECT_GOAL]
<one concise sentence>

[CURRENT_TASK]
<one concise sentence>

[TECH_STACK]
- <item>
- <item>

[ARCHITECTURE_DECISIONS]
- <item>
- <item>

[PENDING_TASKS]
- <item>
- <item>

[RECENT_PROGRESS]
- <item>
- <item>

[IMPORTANT_CONTEXT]
- <item>
- <item>

[USER_INTENT]
<one concise sentence>

[CONVENTIONS]
- <item>
- <item>

Rules:
- Be concise. Avoid filler.
- Only include sections with meaningful content.
- Use bullet points for lists.
- Preserve specific technical details (library names, versions, file paths).
- If a section has no information, omit it entirely.
- Maximum total output: 2000 tokens.`

export function buildSummarizationPrompt(messages: Message[]): GroqMessage[] {
  const formattedConversation = messages
    .map(m => {
      const label = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'System'
      return `[${label}]\n${m.content}`
    })
    .join('\n\n---\n\n')

  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Summarize this conversation:\n\n${formattedConversation}` },
  ]
}

export function buildMigrationPrompt(memory: SummarizedMemory): string {
  const sections: string[] = [
    'You are continuing an existing project.',
    '',
  ]

  if (memory.projectGoal) {
    sections.push('PROJECT:')
    sections.push(memory.projectGoal)
    sections.push('')
  }

  if (memory.techStack.length > 0) {
    sections.push('TECH STACK:')
    memory.techStack.forEach(t => sections.push(`- ${t}`))
    sections.push('')
  }

  if (memory.currentTask) {
    sections.push('CURRENT TASK:')
    sections.push(memory.currentTask)
    sections.push('')
  }

  if (memory.architectureDecisions.length > 0) {
    sections.push('IMPORTANT DECISIONS:')
    memory.architectureDecisions.forEach(d => sections.push(`- ${d}`))
    sections.push('')
  }

  if (memory.pendingTasks.length > 0) {
    sections.push('PENDING TASKS:')
    memory.pendingTasks.forEach(t => sections.push(`- ${t}`))
    sections.push('')
  }

  if (memory.recentProgress.length > 0) {
    sections.push('LATEST PROGRESS:')
    memory.recentProgress.forEach(p => sections.push(`- ${p}`))
    sections.push('')
  }

  if (memory.importantContext.length > 0) {
    sections.push('IMPORTANT CONTEXT:')
    memory.importantContext.forEach(c => sections.push(`- ${c}`))
    sections.push('')
  }

  if (memory.conventions.length > 0) {
    sections.push('CODING CONVENTIONS:')
    memory.conventions.forEach(c => sections.push(`- ${c}`))
    sections.push('')
  }

  if (memory.userIntent) {
    sections.push('USER INTENT:')
    sections.push(memory.userIntent)
    sections.push('')
  }

  sections.push('Continue exactly from this state.')
  sections.push('')

  return sections.join('\n')
}
