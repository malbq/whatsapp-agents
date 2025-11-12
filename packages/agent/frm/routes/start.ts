import type { DB } from '@batman/core/infra/db'
import type { Chat } from '@batman/whatsapp'
import type { Context } from 'hono'
import { findCandidateByPhone, saveData, updateCandidate } from '../lib/dataStore'

export function createStartRoute(db: DB.Repository, chat: Chat) {
  return async function startRoute(c: Context) {
    // Verify bearer token
    const authHeader = c.req.header('Authorization')
    const expectedToken = import.meta.env.START_SECRET_TOKEN

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized: Missing or invalid Authorization header' }, 401)
    }

    const token = authHeader.slice(7) // Remove 'Bearer ' prefix
    if (token !== expectedToken) {
      return c.json({ error: 'Unauthorized: Invalid token' }, 401)
    }

    const phoneNumber = c.req.query('phone')

    if (!phoneNumber) {
      return c.json({ error: 'Phone number is required' }, 400)
    }
    console.log('Starting candidate flow for phone number:', phoneNumber)

    const candidate = findCandidateByPhone(phoneNumber)
    if (!candidate) {
      return c.json({ error: 'Candidate not found' }, 404)
    }
    console.log('Candidate found:', candidate)

    try {
      candidate.currentFlow = 'initial'
      updateCandidate(candidate)
      await saveData()

      // Store user in database first
      const user = await db.persistUser({
        waId: phoneNumber,
        name: candidate.name,
      })

      const templateName = import.meta.env.TEMPLATE_NAME || ''
      console.log('Sending template message for template name:', templateName)
      const templateMessageId = await chat.sendTemplate(phoneNumber, {
        name: templateName,
        language: 'pt_BR',
        bodyParameters: { name: candidate.name, position: candidate.position },
      })
      console.log('Template message sent:', templateMessageId)

      console.log('User stored in database:', user)

      // Store template message in database
      await db.storeMessage([
        {
          userId: user.id,
          waId: templateMessageId,
          type: 'text',
          modelMessage: {
            role: 'assistant',
            content: `Olá ${candidate.name},

Somos do Departamento de Recrutamento e Seleção da empresa FRM.
Com alegria informamos que o seu currículo foi selecionado para participar do processo seletivo para a vaga de *${candidate.position}*.

Gostaria de dar sequência no agendamento da entrevista?`,
          },
          content: [
            {
              content: `Olá ${candidate.name},

Somos do Departamento de Recrutamento e Seleção da empresa FRM.
Com alegria informamos que o seu currículo foi selecionado para participar do processo seletivo para a vaga de *${candidate.position}*.

Gostaria de dar sequência no agendamento da entrevista?`,
              embedding: [],
            },
          ],
        },
      ])
      console.log('Template message stored in database')

      return c.json(
        {
          message: 'Candidate interaction flow started',
          candidate: { id: candidate.id, name: candidate.name, phone: candidate.phone },
        },
        200
      )
    } catch (error) {
      console.error('Error starting candidate flow:', error)
      return c.json({ error: 'Failed to start candidate interaction flow' }, 500)
    }
  }
}
