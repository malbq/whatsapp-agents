import type { Tool } from 'ai'
import { createBookAppointmentTool } from './bookAppointment'
import { createCancelAppointmentTool } from './cancelAppointment'
import { createCheckAvailabilityTool } from './checkAvailability'
import type { ToolContext } from './context'
import { createListAppointmentsTool } from './listAppointments'
import { createRescheduleAppointmentTool } from './rescheduleAppointment'

export function createTools(context: ToolContext): Tool[] {
  return [
    createCheckAvailabilityTool(context),
    createBookAppointmentTool(context),
    createCancelAppointmentTool(context),
    createRescheduleAppointmentTool(context),
    createListAppointmentsTool(context),
  ]
}
