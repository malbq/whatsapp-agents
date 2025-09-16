export const currentSchedule = (
  schedule: Array<string>
) => `This is the current active reminders we have set for the user.
<schedule>
${schedule.join('\n')}
</schedule>
Reference these reminders when relevant to queries about time, schedule, or tasks.`
