export function userProfile(profile: string): string {
  return `Integrate the following user profile to personalize responses.
<user_profile>
${profile}
</user_profile>`
}
