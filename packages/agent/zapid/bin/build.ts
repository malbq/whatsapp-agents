import { existsSync, mkdirSync } from 'node:fs'

const entry = new URL('../instrument.ts', import.meta.url).pathname
const outfile = new URL('./zapid', import.meta.url).pathname
const storageDir = new URL('../storage', import.meta.url).pathname

if (!existsSync(storageDir)) mkdirSync(storageDir, { recursive: true })

const proc = Bun.spawn(
  ['bun', 'build', '--compile', '--minify', '--sourcemap', entry, '--outfile', outfile],
  { stdout: 'inherit', stderr: 'inherit' }
)

const code = await proc.exited
if (code !== 0) process.exit(code)

console.log('Built executable:', outfile)
