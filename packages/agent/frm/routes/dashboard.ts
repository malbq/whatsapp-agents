import type { Context } from 'hono'
import type { FrmDB } from '../db'
import { DashboardPage } from '../ui/pages'

export function createDashboardRoute(frmDB: FrmDB) {
  return async (c: Context) => {
    const candidates = await frmDB.listCandidates()
    const slots = await frmDB.getAllSlots()
    const interviews = await frmDB.listInterviews()
    const companyInfo = await frmDB.getCompanyInfo()
    const startSecretToken = import.meta.env.START_SECRET_TOKEN || ''
    return c.html(DashboardPage({ candidates, slots, interviews, companyInfo, startSecretToken }))
  }
}
