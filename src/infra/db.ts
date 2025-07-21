import type { User } from '../domain/user'

export interface DB {
  storeWebhookEvent: (payload: string) => Promise<void>
  findUser: (externalId: User['externalId']) => Promise<User | null>
  storeUser: (user: Pick<User, 'externalId' | 'name'>) => Promise<User>
}
