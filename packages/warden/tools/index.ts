import type { Tool } from 'ai'
import { createBookAppointmentTool } from './bookAppointment'
import { createCancelAppointmentTool } from './cancelAppointment'
import { createCheckAvailabilityTool } from './checkAvailability'
import type { ToolContext } from './context'
import { createRescheduleAppointmentTool } from './rescheduleAppointment'

export type { ToolContext } from './context'

export function createTools(context: ToolContext): Tool[] {
  return [
    createCheckAvailabilityTool(context),
    createBookAppointmentTool(context),
    createCancelAppointmentTool(context),
    createRescheduleAppointmentTool(context),
  ]
}
