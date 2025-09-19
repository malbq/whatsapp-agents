import { getLogger } from '@logtape/logtape'
import { Whatsapp } from '../infra/chatWhatsapp'
import type { DueReminderItem } from '../infra/db'
import { LibSql } from '../infra/dbLibSql'

const logger = getLogger(['scheduler'])

type SchedulerDeps = {
  db: ReturnType<typeof LibSql.db>
  chat: typeof Whatsapp.chat
  now?: Date
  batchSize?: number
}

export async function runSchedulerTick({
  db,
  chat,
  now = new Date(),
  batchSize = 100,
}: SchedulerDeps) {
  logger.info('Tick', { now: now.toISOString(), batchSize })

  const dueReminders = await db.takeDueReminders({ now, limit: batchSize })

  if (dueReminders.length === 0) {
    logger.debug('No due reminders found')
    return
  }

  logger.info(`Processing ${dueReminders.length} due reminders`)

  const processReminder = async (
    reminder: DueReminderItem,
    db: ReturnType<typeof LibSql.db>,
    chat: typeof Whatsapp.chat
  ) => {
    try {
      logger.debug(
        `Sending reminder ${reminder.id} to user ${reminder.userId}${
          reminder.isReclaimed ? ' (Reclaimed)' : ''
        }`
      )

      // TODO: Context setup for businessPhoneNumberId and userWhatsappId
      // will need to be handled when we implement the actual WhatsApp sending
      // For now, this is a placeholder that needs proper context setup

      const waMessageId = await chat.sendTextMessage({
        text: reminder.message,
        // Note: This will need proper context setup for user-specific sending
      })

      await db.markReminderSent({ id: reminder.id, waMessageId })
      logger.info(`Reminder ${reminder.id} sent successfully`)
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`Failed to send reminder ${reminder.id}`, {
        error: errorMessage,
        userId: reminder.userId,
      })

      await db.markReminderFailed({ id: reminder.id, error: errorMessage })
    }
  }

  for (let i = 0; i < dueReminders.length; i++) {
    await processReminder(dueReminders[i]!, db, chat)
  }

  logger.info('Scheduler tick completed', { processedCount: dueReminders.length })
}

if (import.meta.main) {
  const db = LibSql.db()
  const chat = Whatsapp.chat

  await runSchedulerTick({ db, chat })
    .then(() => {
      process.exit(0)
    })
    .catch((error) => {
      logger.error('Scheduler tick failed', { error: error.message })
      process.exit(1)
    })
}
