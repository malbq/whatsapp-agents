export type SchedulerStatus = 'running' | 'stopped' | 'inactive'

export interface Scheduler {
  setup(): Promise<void>
  destroy(): Promise<void>
  getStatus(): Promise<SchedulerStatus>
}
