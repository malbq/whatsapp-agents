export const userProfile = (
  profile: string
) => `Instruction: Integrate the following user profile to personalize responses without repetition.
<user_profile>
${profile}
</user_profile>`
