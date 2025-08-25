#!/usr/bin/env bun

import { $ } from 'bun'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'

const dbPath = process.argv[2] || './storage/db.db'

const scriptsDir = await readdir(import.meta.dir)
const scripts = scriptsDir.filter((file) => file.endsWith('.sql'))

for (const script of scripts) {
  const scriptPath = join(import.meta.dir, script)
  await $`sqlite3 ${dbPath} < ${scriptPath}`
}
