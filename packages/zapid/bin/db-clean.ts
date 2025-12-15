import { SQL } from 'bun'

const client = new SQL(import.meta.env.DATABASE_URL)

const publicTables = await client.unsafe(`
  SELECT tablename 
  FROM pg_tables 
  WHERE schemaname = 'public'
`)

const tables = publicTables.map((row: { tablename: string }) => row.tablename)

if (tables.length > 0) {
  const dropStatement = `DROP TABLE IF EXISTS ${tables
    .map((t: string) => `"${t}"`)
    .join(', ')} CASCADE`
  await client.unsafe(dropStatement)
  console.log(`Dropped ${tables.length} public table(s): ${tables.join(', ')}`)
} else {
  console.log('No public tables to drop.')
}

await client.unsafe('DROP SCHEMA IF EXISTS drizzle CASCADE')
console.log('Dropped drizzle schema.')

await client.close()
