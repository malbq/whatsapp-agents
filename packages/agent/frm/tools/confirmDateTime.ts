import { tool } from 'ai'
import { z } from 'zod'
import type { FrmToolContext } from '../types'

export function createConfirmDateTimeTool(ctx: FrmToolContext) {
  return tool({
    name: 'confirm_datetime',
    description:
      'Confirmar se uma data e hora proposta estão disponíveis para agendamento de entrevista, enviando botões interativos para confirmação.',
    inputSchema: z.object({
      date: z.string().describe('Data no formato YYYY-MM-DD'),
      time: z.string().describe('Hora no formato HH:MM'),
    }),
    execute: async ({ date, time }) => {
      const slot = ctx.dataStore.availableSlots.find(
        (slot) => slot.date === date && slot.time === time && slot.available
      )

      if (!slot) {
        // Send interactive button to choose another time
        await ctx.chat.sendInteractiveButton(ctx.userWhatsappId, {
          body: {
            text: `O horário ${date} às ${time} não está mais disponível. Gostaria de escolher outro horário?`,
          },
          action: {
            buttons: [
              {
                type: 'reply',
                reply: {
                  id: 'choose_another_time',
                  title: 'Escolher outro horário',
                },
              },
              {
                type: 'reply',
                reply: {
                  id: 'cancel_scheduling',
                  title: 'Cancelar agendamento',
                },
              },
            ],
          },
        })

        return `Horário não disponível. Enviado botões interativos para escolher outro horário.`
      }

      // Send confirmation buttons
      await ctx.chat.sendInteractiveButton(ctx.userWhatsappId, {
        body: {
          text: `Confirme o agendamento da entrevista:\n\n📅 Data: ${date}\n🕐 Horário: ${time}\n🏢 Local: ${ctx.dataStore.companyInfo.location}`,
        },
        footer: {
          text: ctx.dataStore.companyInfo.contact,
        },
        action: {
          buttons: [
            {
              type: 'reply',
              reply: {
                id: `confirm_${date}_${time.replace(':', '')}`,
                title: '✅ Confirmar agendamento',
              },
            },
            {
              type: 'reply',
              reply: {
                id: 'choose_different_time',
                title: '📅 Escolher outro horário',
              },
            },
          ],
        },
      })

      return `Horário disponível. Enviado botões interativos para confirmação do agendamento.`
    },
  })
}
