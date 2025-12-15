import type { Context } from 'hono'
import type { FrmDB } from '../db'

export function createCandidateRoutes(frmDB: FrmDB) {
  return {
    async create(c: Context) {
      try {
        const body = await c.req.json()

        if (!body.name || !body.phone || !body.position) {
          return c.json({ error: 'Name, phone, and position are required' }, 400)
        }

        const candidate = await frmDB.createCandidate({
          name: body.name,
          phone: body.phone,
          position: body.position,
          currentFlow: undefined,
        })

        return c.json({ success: true, candidate }, 201)
      } catch (error) {
        console.error('Error creating candidate:', error)
        return c.json({ error: 'Failed to create candidate' }, 500)
      }
    },

    async update(c: Context) {
      try {
        const id = c.req.param('id')
        const body = await c.req.json()

        const candidate = await frmDB.getCandidate(id)
        if (!candidate) {
          return c.json({ error: 'Candidate not found' }, 404)
        }

        const updatedCandidate = {
          ...candidate,
          name: body.name !== undefined ? body.name : candidate.name,
          phone: body.phone !== undefined ? body.phone : candidate.phone,
          position: body.position !== undefined ? body.position : candidate.position,
          currentFlow: body.currentFlow !== undefined ? body.currentFlow : candidate.currentFlow,
        }

        await frmDB.updateCandidate(updatedCandidate)

        return c.json({ success: true, candidate: updatedCandidate })
      } catch (error) {
        console.error('Error updating candidate:', error)
        return c.json({ error: 'Failed to update candidate' }, 500)
      }
    },

    async delete(c: Context) {
      try {
        const id = c.req.param('id')

        const candidate = await frmDB.getCandidate(id)
        if (!candidate) {
          return c.json({ error: 'Candidate not found' }, 404)
        }

        await frmDB.deleteCandidate(id)

        return c.json({ success: true, message: 'Candidate deleted' })
      } catch (error) {
        console.error('Error deleting candidate:', error)
        return c.json({ error: 'Failed to delete candidate' }, 500)
      }
    },

    async get(c: Context) {
      try {
        const id = c.req.param('id')
        const candidate = await frmDB.getCandidate(id)

        if (!candidate) {
          return c.json({ error: 'Candidate not found' }, 404)
        }

        return c.json({ success: true, candidate })
      } catch (error) {
        console.error('Error fetching candidate:', error)
        return c.json({ error: 'Failed to fetch candidate' }, 500)
      }
    },

    async list(c: Context) {
      try {
        const candidates = await frmDB.listCandidates()
        return c.json({ success: true, candidates })
      } catch (error) {
        console.error('Error listing candidates:', error)
        return c.json({ error: 'Failed to list candidates' }, 500)
      }
    },
  }
}
