import { existsSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const pidFile = join(root, 'storage', 'zapid.pid')

if (!existsSync(pidFile)) {
  console.error('No PID file. Zapid not running?')
  process.exit(1)
}

const pid = readFileSync(pidFile, 'utf8').trim()
if (!pid) {
  console.error('Empty PID file.')
  process.exit(1)
}

try {
  process.kill(Number(pid), 'SIGTERM')
  console.log('Sent SIGTERM to PID', pid)
} catch (e: unknown) {
  // Process already dead (ESRCH) — clean up stale PID file
  if (e instanceof Error && 'code' in e && e.code === 'ESRCH') {
    rmSync(pidFile, { force: true })
    console.log('Process already stopped. Cleaned up stale PID file.')
    process.exit(0)
  }
  throw e
}

// Wait and verify; escalate if needed
await Bun.sleep(1500)
let alive = true
try {
  process.kill(Number(pid), 0)
} catch {
  alive = false
}
if (alive) {
  console.warn('Process still alive, sending SIGKILL')
  try {
    process.kill(Number(pid), 'SIGKILL')
  } catch (e) {
    console.error('Failed to kill process:', e)
    process.exit(1)
  }
}

rmSync(pidFile, { force: true })
console.log('Zapid stopped.')
