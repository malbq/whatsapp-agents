import chalk from 'chalk'
import { WA } from '../infra/whatsapp'

export async function handleStatusUpdate(statusUpdate: WA.StatusUpdate) {
  console.debug(chalk.green('Status update:', statusUpdate.status))
}
