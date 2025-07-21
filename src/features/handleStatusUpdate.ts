import chalk from 'chalk'
import type { StatusUpdate } from '../domain/message'

export async function handleStatusUpdate(statusUpdate: StatusUpdate) {
  console.debug(chalk.green('Status update:', statusUpdate.status))
}
