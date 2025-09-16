import type { SimilarMessage } from '../infra/db'

export const userMemory = (
  memory: Array<SimilarMessage>
) => `Instruction: Integrate the following memories from conversation history to provide context-aware and personalized responses. If a memory is unclear or conflicting, prioritize recent information.
<memory>
${memory
  .map(
    (m) =>
      `${m.role}: ${m.content} (chunk ${m.chunkSequence}/${
        m.totalChunks
      }) (${m.timestamp.toISOString()})`
  )
  .join('\n')}
</memory>`
