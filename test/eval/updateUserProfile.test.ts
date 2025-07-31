import { describe, expect, setDefaultTimeout, test } from 'bun:test'
import { AIProvider } from '../../src/infra/ai'

setDefaultTimeout(30000)

describe.if(!!process.env.TEST_AI)('Update user profile', () => {
  test('should define user language', async () => {
    const profile = await AIProvider.updateUserProfile({
      profile: '',
      message: 'Olá.',
    })
    expect(profile.toLowerCase()).toContain('portuguese')
  })

  test('should extract detailed information from elaborate message with no profile', async () => {
    const profile = await AIProvider.updateUserProfile({
      profile: '',
      message:
        'Oi, eu sou a Maria de São Paulo. Trabalho como engenheira de software e adoro fazer trilhas nos fins de semana. Tenho um cachorro chamado Max e estou planejando uma viagem para a Europa no próximo mês.',
    })
    expect(profile.toLowerCase()).toContain('portuguese')
    expect(profile.toLowerCase()).toContain('maria')
    expect(profile.toLowerCase()).toContain('são paulo')
    expect(profile.toLowerCase()).toContain('software engineer')
    expect(profile.toLowerCase()).toContain('hiking')
    expect(profile.toLowerCase()).toContain('dog')
    expect(profile.toLowerCase()).toContain('max')
    expect(profile.toLowerCase()).toContain('europe')
  })

  test('should not change profile for short message with existing profile', async () => {
    const existingProfile =
      'User speaks portuguese. Works as software engineer in São Paulo. Has dog named Max. Enjoys hiking.'
    const profile = await AIProvider.updateUserProfile({
      profile: existingProfile,
      message: 'Ok',
    })
    expect(profile).toBe('')
  })
})
