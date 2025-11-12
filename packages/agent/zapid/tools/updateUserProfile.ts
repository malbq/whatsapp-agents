import { tool } from 'ai'
import { z } from 'zod'
import type { ToolExecutionError } from '@batman/core/errors'
import { spreadError } from '@batman/core/utils/spreadError'
import type { Frame } from '../frame'

interface UpdateUserProfileDeps {
  db: {
    updateUserProfile: (params: { userId: string; profile: string }) => Promise<string>
  }
}

export const updateUserProfileTool = (frame: Frame, deps: UpdateUserProfileDeps) =>
  tool({
    name: 'update_user_profile',
    description: `Goal: Enrich the user profile with only explicit, minimal facts that aid personalization, strictly following Brazil'S GPD and privacy rules.

Sensitive data (never store or infer): racial/ethnic origin, religion, politics, unions, health/sex life, genetic/biometric data, or any inferences about these (e.g., family implying genetics, hobbies implying beliefs, job implying unions).
Risk flags (handle with extra caution; avoid inferences): age (esp. minors), location suggesting origins, family/best friends (genetics/affiliations), work/interests/plans that could imply politics/health/religion.

Benign location rule: You may store general, non-sensitive location for personalization (city, country, timezone).
Do NOT store precise addresses, neighborhoods, habitual places, birthplace/origins, travel history, or any location hinting at sensitive traits unless the lastMessage both shares it and explicitly consents to storage.

Consent rules:
- For any item that could be sensitive, store it only if the lastMessage explicitly asks you to store it (e.g., "store my family info").
- Contact info (email/phone/handle): store only if the user provides it AND explicitly opts in to storage.
- If the user refuses storage for any category, append that no-consent preference and honor it later.
- Sharing and disclosing only is not consent. Explicit opt-in is required.

What you may store (minimal, non-sensitive, user-stated only):
- Name/preferred name/username and pronouns (verbatim; no guesses)
- Languages they use/understand
- Preferred tone/style/format/level (e.g., brief, step-by-step)
- Interests/hobbies (non-sensitive only)
- Current plans or ongoing projects
- General location/timezone per the benign rule (no derivations from other facts)
- Availability windows (e.g., mornings, weekends)
- Role/occupation/industry (avoid union/political inferences)
- Communication preferences and notification cadence
- Contact info if explicitly provided with opt-in
- Consent/opt-out preferences by category

Sources:
- Non-sensitive items: use explicit statements from the entire conversation history.
- Sensitive-category candidates and contact info: require disclosure + explicit storage consent in the lastMessage.
- Never infer or generalize beyond what was stated.
- Derived preferences: If a preference is explicitly stated alongside sensitive information, store only the non-sensitive preference (e.g., "prefers well-ventilated places") without referencing the sensitive context, if it aids personalization.

Update algorithm:
1) Start with the current profile verbatim. Do not edit, reorder, or delete existing text.
2) Identify explicit new facts not already present. Treat semantically equivalent facts (even if worded differently) as duplicates and do not add them.
3) On conflicts, append the newer fact as an additional line. Keep both; keep each short.
4) Add only relevant items allowed above. Skip anything else.
5) If nothing new qualifies, output empty text.

Output requirements:
- Output the full updated profile (current content plus any new items), plain text, English only. No markdown, no JSON, no labels.
- Be concise. Short sentences. Under 2000 characters. If it exceeds 2000, summarize it while preserving meaning, consents/opt-outs, and contact statuses.
- Do not remove existing information.
- If the info is already stored or the message is not relevant, output empty text (no quotes, no spaces, no new lines).
- Fail silently. Do not notify user of errors from this tool.`,
    inputSchema: z.object({
      improvedProfile: z.string().describe('The improved profile to update'),
    }),
    execute: async ({ improvedProfile }) => {
      try {
        if (!frame.user) {
          console.error('missing user', {
            improvedProfile,
            profileLength: improvedProfile.length,
          })
          return {
            error: 'Missing user',
            details: 'Could not update profile due to missing user',
          } satisfies ToolExecutionError
        }
        if (improvedProfile.trim().length === 0) {
          console.warn('skipped, no improvement', {
            improvedProfile,
            currentProfileLength: frame.user.profile?.length ?? 0,
          })
          return 'No improvement to make'
        }

        if (improvedProfile === frame.user.profile) {
          console.warn('skipped, same profile', {
            improvedProfile,
            profileLength: improvedProfile.length,
          })
          return 'You cannot update the profile to the same profile'
        }

        const profileVersionId = await deps.db.updateUserProfile({
          userId: frame.user.id,
          profile: improvedProfile,
        })

        if (profileVersionId) {
          frame.profileVersionId = profileVersionId
        }

        console.log('completed', {
          userId: frame.user.id,
          profileVersionId,
          currentProfileLength: frame.user.profile?.length ?? 0,
          improvedProfileLength: improvedProfile.length,
        })
        console.debug('profile diff', {
          current: frame.user.profile ?? '',
          improved: improvedProfile,
        })

        return 'Profile updated'
      } catch (error) {
        console.error('Tool execution failed', {
          improvedProfile,
          ...spreadError(error),
        })
        return {
          error: 'Tool execution failed',
          details: error instanceof Error ? error.message : 'unknown',
        } satisfies ToolExecutionError
      }
    },
  })
