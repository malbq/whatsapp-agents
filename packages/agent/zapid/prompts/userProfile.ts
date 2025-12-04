import type { SystemModelMessage } from 'ai'

export function userProfile(profile: string): SystemModelMessage {
  return {
    role: 'system',
    content: `Integrate the following user profile to personalize responses.
<user_profile>
${profile}
</user_profile>`,
  }
}
