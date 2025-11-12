import type { SystemModelMessage } from 'ai'

export function userProfile(profile: string): SystemModelMessage {
  return {
    role: 'system',
    content: `Instruction: Integrate the following user profile to personalize responses without repetition.
<user_profile>
${profile}
</user_profile>`,
  }
}
