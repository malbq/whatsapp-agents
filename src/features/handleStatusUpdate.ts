import chalk from 'chalk'
import type { StatusUpdate } from '../domain'

export async function handleStatusUpdate(statusUpdate: StatusUpdate) {
  console.debug(chalk.green('Status update:', statusUpdate.status))
}
