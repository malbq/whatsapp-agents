import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const envFile = join(root, '.env.production')
const storage = join(root, 'storage')
const binExec = join(root, 'bin', 'zapid')
const pidFile = join(storage, 'zapid.pid')
const outLog = join(storage, 'zapid.out.log')
const errLog = join(storage, 'zapid.err.log')
const port = parseInt(import.meta.env.PORT || '8080', 10)

if (!existsSync(storage)) mkdirSync(storage, { recursive: true })

// Check PID
if (existsSync(pidFile)) {
  const pid = readFileSync(pidFile, 'utf8').trim()
  if (pid) {
    try {
      process.kill(Number(pid), 0)
      console.error('Zapid already running with PID', pid)
      process.exit(1)
    } catch {
      // stale PID, continue
    }
  }
}

// Check port (best-effort)
const ss = Bun.spawn(['sh', '-c', `ss -ltn sport = :${port} | grep -q LISTEN`], {
  stdout: 'ignore',
  stderr: 'ignore',
})
const ssCode = await ss.exited
if (ssCode === 0) {
  console.error(`Port ${port} is in use. Abort.`)
  process.exit(1)
}

if (!existsSync(binExec)) {
  console.error('Executable not found:', binExec)
  console.error('Run: bun run ./bin/build.ts')
  process.exit(1)
}

if (!existsSync(envFile)) {
  console.error('.env.production not found:', envFile)
  console.error('Copy .env to .env.production and set NODE_ENV=production')
  process.exit(1)
}

// Start detached with setsid, load .env.production
const cmd = `set -a && . "${envFile}" && set +a && setsid "${binExec}" 1>>"${outLog}" 2>>"${errLog}" & echo $!`
const sh = Bun.spawn(['sh', '-c', cmd], { stdout: 'pipe', stderr: 'inherit' })
const pidOut = await new Response(sh.stdout).text()
const pid = pidOut.trim()

if (!pid) {
  console.error('Failed to obtain PID')
  process.exit(1)
}

writeFileSync(pidFile, pid + '\n')
console.log(`Zapid started. PID=${pid}`)
console.log(`Logs: Sentry (stdout), ${errLog} (stderr)`)
