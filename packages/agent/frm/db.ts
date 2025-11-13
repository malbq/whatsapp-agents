import type { DB } from '@batman/core/infra/db'
import { Postgres } from '@batman/core/infra/dbPostgres'
import { extractText } from '@batman/core/utils/extractTextContent'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/bun-sql'
import * as schema from './dbSchema'
import type { Candidate, CompanyInfo, Interview, InterviewSlot } from './types'

export interface ThreadMessage {
  id: string
  role: string
  type: string
  timestamp: Date
  content: string
}

export interface Thread {
  userId: string
  userName: string
  externalId: string
  messages: Array<ThreadMessage>
}

export interface FrmDB extends DB.Repository {
  getCompanyInfo: () => Promise<CompanyInfo>
  updateCompanyInfo: (info: CompanyInfo) => Promise<void>
  findCandidateByPhone: (phone: string) => Promise<Candidate | null>
  getCandidate: (id: string) => Promise<Candidate | null>
  createCandidate: (candidate: Omit<Candidate, 'id'>) => Promise<Candidate>
  updateCandidate: (candidate: Candidate) => Promise<void>
  deleteCandidate: (id: string) => Promise<void>
  listCandidates: () => Promise<Candidate[]>
  getAvailableSlots: () => Promise<InterviewSlot[]>
  getAllSlots: () => Promise<InterviewSlot[]>
  createSlot: (slot: Omit<InterviewSlot, 'id'>) => Promise<InterviewSlot>
  findSlotByDateTime: (date: string, time: string) => Promise<InterviewSlot | null>
  findSlotByCandidateId: (candidateId: string) => Promise<InterviewSlot | null>
  bookSlotByDateTime: (
    date: string,
    time: string,
    candidateId: string
  ) => Promise<InterviewSlot | null>
  freeSlot: (slotId: string) => Promise<void>
  createInterview: (interview: Omit<Interview, 'id'>) => Promise<Interview>
  getInterview: (id: string) => Promise<Interview | null>
  updateInterview: (interview: Interview) => Promise<void>
  listInterviews: () => Promise<Interview[]>
  listThreads: () => Promise<Array<Thread>>
}

export const dbFactory = ({ url }: { url: string }): FrmDB => {
  const client = drizzle(url, { schema })
  const coreDB = Postgres.dbFactory({ client })

  return {
    ...coreDB,

    async getCompanyInfo() {
      const result = await client
        .select()
        .from(schema.companyInfo)
        .where(eq(schema.companyInfo.id, 'company'))
        .limit(1)

      if (result.length === 0) {
        const defaultInfo: CompanyInfo = {
          name: 'TechCorp',
          location: 'São Paulo, SP',
          contact: 'contato@techcorp.com.br',
        }
        await this.updateCompanyInfo(defaultInfo)
        return defaultInfo
      }

      const row = result[0]!
      return {
        name: row.name,
        location: row.location,
        contact: row.contact,
      }
    },

    async updateCompanyInfo(info: CompanyInfo) {
      await client
        .insert(schema.companyInfo)
        .values({
          id: 'company',
          name: info.name,
          location: info.location,
          contact: info.contact,
        })
        .onConflictDoUpdate({
          target: schema.companyInfo.id,
          set: {
            name: info.name,
            location: info.location,
            contact: info.contact,
            updatedAt: new Date(),
          },
        })
    },

    async findCandidateByPhone(phone: string) {
      const result = await client
        .select()
        .from(schema.candidate)
        .where(eq(schema.candidate.phone, phone))
        .limit(1)

      if (result.length === 0) return null

      const row = result[0]!
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        position: row.position,
        currentFlow: row.currentFlow ?? undefined,
      }
    },

    async getCandidate(id: string) {
      const result = await client
        .select()
        .from(schema.candidate)
        .where(eq(schema.candidate.id, id))
        .limit(1)

      if (result.length === 0) return null

      const row = result[0]!
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        position: row.position,
        currentFlow: row.currentFlow ?? undefined,
      }
    },

    async createCandidate(candidateData: Omit<Candidate, 'id'>) {
      const id = Bun.randomUUIDv7()
      const result = await client
        .insert(schema.candidate)
        .values({
          id,
          name: candidateData.name,
          phone: candidateData.phone,
          position: candidateData.position,
          currentFlow: candidateData.currentFlow ?? null,
        })
        .returning()

      const row = result[0]!
      return {
        id: row.id,
        name: row.name,
        phone: row.phone,
        position: row.position,
        currentFlow: row.currentFlow ?? undefined,
      }
    },

    async updateCandidate(candidateData: Candidate) {
      await client
        .update(schema.candidate)
        .set({
          name: candidateData.name,
          phone: candidateData.phone,
          position: candidateData.position,
          currentFlow: candidateData.currentFlow ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.candidate.id, candidateData.id))
    },

    async deleteCandidate(id: string) {
      await client.delete(schema.candidate).where(eq(schema.candidate.id, id))
    },

    async listCandidates() {
      const result = await client.select().from(schema.candidate)
      return result.map((row) => ({
        id: row.id,
        name: row.name,
        phone: row.phone,
        position: row.position,
        currentFlow: row.currentFlow ?? undefined,
      }))
    },

    async getAvailableSlots() {
      const result = await client
        .select()
        .from(schema.interviewSlot)
        .where(eq(schema.interviewSlot.available, true))

      return result.map((row) => ({
        id: row.id,
        date: row.date,
        time: row.time,
        available: row.available,
        candidateId: row.candidateId ?? undefined,
      }))
    },

    async getAllSlots() {
      const result = await client.select().from(schema.interviewSlot)

      return result.map((row) => ({
        id: row.id,
        date: row.date,
        time: row.time,
        available: row.available,
        candidateId: row.candidateId ?? undefined,
      }))
    },

    async createSlot(slotData: Omit<InterviewSlot, 'id'>) {
      const id = Bun.randomUUIDv7()
      const result = await client
        .insert(schema.interviewSlot)
        .values({
          id,
          date: slotData.date,
          time: slotData.time,
          available: slotData.available ?? true,
          candidateId: slotData.candidateId ?? null,
        })
        .returning()

      const row = result[0]!
      return {
        id: row.id,
        date: row.date,
        time: row.time,
        available: row.available,
        candidateId: row.candidateId ?? undefined,
      }
    },

    async findSlotByDateTime(date: string, time: string) {
      const result = await client
        .select()
        .from(schema.interviewSlot)
        .where(and(eq(schema.interviewSlot.date, date), eq(schema.interviewSlot.time, time)))
        .limit(1)

      if (result.length === 0) return null

      const row = result[0]!
      return {
        id: row.id,
        date: row.date,
        time: row.time,
        available: row.available,
        candidateId: row.candidateId ?? undefined,
      }
    },

    async findSlotByCandidateId(candidateId: string) {
      const result = await client
        .select()
        .from(schema.interviewSlot)
        .where(
          and(
            eq(schema.interviewSlot.candidateId, candidateId),
            eq(schema.interviewSlot.available, false)
          )
        )
        .limit(1)

      if (result.length === 0) return null

      const row = result[0]!
      return {
        id: row.id,
        date: row.date,
        time: row.time,
        available: row.available,
        candidateId: row.candidateId ?? undefined,
      }
    },

    async bookSlotByDateTime(date: string, time: string, candidateId: string) {
      const slot = await this.findSlotByDateTime(date, time)
      if (!slot || !slot.available) {
        return null
      }

      await client
        .update(schema.interviewSlot)
        .set({
          available: false,
          candidateId,
          updatedAt: new Date(),
        })
        .where(eq(schema.interviewSlot.id, slot.id))

      return {
        ...slot,
        available: false,
        candidateId,
      }
    },

    async freeSlot(slotId: string) {
      await client
        .update(schema.interviewSlot)
        .set({
          available: true,
          candidateId: null,
          updatedAt: new Date(),
        })
        .where(eq(schema.interviewSlot.id, slotId))
    },

    async createInterview(interviewData: Omit<Interview, 'id'>) {
      const id = Bun.randomUUIDv7()
      const result = await client
        .insert(schema.interview)
        .values({
          id,
          candidateId: interviewData.candidateId,
          candidateName: interviewData.candidateName,
          slotId: interviewData.slotId,
          status: interviewData.status,
          scheduledAt: interviewData.scheduledAt,
          result: interviewData.result ?? null,
          resultProcessedAt: interviewData.resultProcessedAt ?? null,
        })
        .returning()

      const row = result[0]!
      return {
        id: row.id,
        candidateId: row.candidateId,
        candidateName: row.candidateName,
        slotId: row.slotId,
        status: row.status,
        scheduledAt: row.scheduledAt,
        result: row.result ?? undefined,
        resultProcessedAt: row.resultProcessedAt ?? undefined,
      }
    },

    async getInterview(id: string) {
      const result = await client
        .select()
        .from(schema.interview)
        .where(eq(schema.interview.id, id))
        .limit(1)

      if (result.length === 0) return null

      const row = result[0]!
      return {
        id: row.id,
        candidateId: row.candidateId,
        candidateName: row.candidateName,
        slotId: row.slotId,
        status: row.status,
        scheduledAt: row.scheduledAt,
        result: row.result ?? undefined,
        resultProcessedAt: row.resultProcessedAt ?? undefined,
      }
    },

    async updateInterview(interviewData: Interview) {
      await client
        .update(schema.interview)
        .set({
          candidateId: interviewData.candidateId,
          candidateName: interviewData.candidateName,
          slotId: interviewData.slotId,
          status: interviewData.status,
          scheduledAt: interviewData.scheduledAt,
          result: interviewData.result ?? null,
          resultProcessedAt: interviewData.resultProcessedAt ?? null,
          updatedAt: new Date(),
        })
        .where(eq(schema.interview.id, interviewData.id))
    },

    async listInterviews() {
      const result = await client.select().from(schema.interview)
      return result.map((row) => ({
        id: row.id,
        candidateId: row.candidateId,
        candidateName: row.candidateName,
        slotId: row.slotId,
        status: row.status,
        scheduledAt: row.scheduledAt,
        result: row.result ?? undefined,
        resultProcessedAt: row.resultProcessedAt ?? undefined,
      }))
    },

    async listThreads() {
      const users = await client.query.user.findMany({
        columns: {
          id: true,
          name: true,
          waId: true,
        },
        orderBy: (user, { desc }) => [desc(user.joinedAt)],
      })

      const threads: Array<Thread> = []

      for (const user of users) {
        const userId = user.id
        if (!userId) continue

        const messages = await client.query.message.findMany({
          where: (message, { eq }) => eq(message.userId, userId),
          orderBy: (message, { asc }) => [asc(message.timestamp)],
        })

        const messagesWithContent: Array<ThreadMessage> = []

        for (const msg of messages) {
          const msgId = msg.id
          if (!msgId) continue

          messagesWithContent.push({
            id: msgId,
            role: msg.modelMessage.role,
            type: msg.type,
            timestamp: msg.timestamp,
            content: extractText(msg.modelMessage) ?? '',
          })
        }

        threads.push({
          userId,
          userName: user.name,
          externalId: user.waId,
          messages: messagesWithContent,
        })
      }

      return threads
    },
  }
}
