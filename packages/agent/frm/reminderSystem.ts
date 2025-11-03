import type { FrmDataStore } from './types'

export function checkAndSendReminders(
  dataStore: FrmDataStore,
  sendText: (text: string) => Promise<void>
): void {
  const now = new Date()

  // Find due timers that haven't been sent
  const dueTimers = Array.from(dataStore.timers.values()).filter(
    (timer) => !timer.sent && timer.dueAt <= now
  )

  for (const timer of dueTimers) {
    // Send reminder message
    sendText(timer.message).catch((error) => {
      console.error('Failed to send reminder:', error)
    })

    // Mark as sent
    timer.sent = true

    // Update the timer in the map
    dataStore.timers.set(timer.id, timer)
  }
}
