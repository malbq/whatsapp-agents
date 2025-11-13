import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './dbSchema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
