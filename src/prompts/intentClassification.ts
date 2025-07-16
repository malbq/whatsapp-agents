import { zodTextFormat } from 'openai/helpers/zod'
import { z } from 'zod'

/**
 * Guia Anthropic para classificação: https://github.com/anthropics/anthropic-cookbook/blob/main/skills/classification/guide.ipynb
 * Idealizado para classificar a necessidade de adicionar contexto extra para o assistente.
 * Não será utilizado se todo o conteúdo trocado com o assistente for vetorizado.
 * Neste caso, tudo se tornará memória.
 */

export const instructions = `Identify user intent in inputs for an AI personal assistant by deciding the necessary context to be added to the agent's prompt.

- **memory**: New or personal context discussions. Usually required.
- **schedule**: Mentions of scheduling, reminders, appointments.
- **file**: Express need of files, documents, or images. Audios are always transcribed, so they should not be considered files.
- **web**: General questions not tied to personal context.

# Notes
- Think carefully step by step about user's request and what information we might need to better answer them.
- Always include "memory" context unless it's clear the query is purely impersonal.

# Examples

<user>Help me create a taks list for today's activities.</user>  
<assistant>{"context": ["memory", "schedule"]}</assistant>

<user>What is the weather today?</user>  
<assistant>{"context": ["web"]}</assistant>

<user>Clear all workout reminders</user>  
<assistant>{"context": ["schedule"]}</assistant>

<user>My favorite desset is cake</user>  
<assistant>{"context": ["memory"]}</assistant>

<user>Where did I buy groceries last week?</user>  
<assistant>{"context": ["memory"]}</assistant>
`

export const requiredContext = ['memory', 'schedule', 'file', 'web'] as const

export const format = zodTextFormat(
  z.object({
    context: z.array(z.enum(requiredContext)),
  }),
  'intent_classification'
)
