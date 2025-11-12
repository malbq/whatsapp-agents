import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import type { Scheduler } from './scheduler'
import { createSchedulerSystemd } from './schedulerSystemd'

const testUnitName = `test-scheduler-${Date.now()}`
const testTickScript = '/tmp/test-tick-script.ts'
const testSystemdDir = `/tmp/test-systemd-${Date.now()}`
let scheduler: Scheduler
describe('SchedulerSystemd', () => {
  beforeAll(async () => {
    await Bun.$`mkdir -p ${testSystemdDir}`
    await Bun.write(testTickScript, '#!/usr/bin/env bun\nconsole.log("Test tick script")')
    await Bun.$`chmod +x ${testTickScript}`

    scheduler = createSchedulerSystemd(testUnitName, testTickScript, testSystemdDir)
  })

  afterEach(async () => {
    try {
      await scheduler.destroy()
    } catch {}
  })

  afterAll(async () => {
    await Bun.$`rm -f ${testTickScript}`.nothrow()
    await Bun.$`rm -rf ${testSystemdDir}`.nothrow()
  })

  test('setup creates systemd units', async () => {
    await scheduler.setup()

    const servicePath = `${testSystemdDir}/${testUnitName}.service`
    const timerPath = `${testSystemdDir}/${testUnitName}.timer`

    const serviceExists = await Bun.file(servicePath).exists()
    const timerExists = await Bun.file(timerPath).exists()

    expect(serviceExists).toBe(true)
    expect(timerExists).toBe(true)

    const status = await scheduler.getStatus()
    expect(['running', 'stopped', 'inactive']).toContain(status)
  })

  test('destroy removes systemd units', async () => {
    await scheduler.setup()

    const servicePath = `${testSystemdDir}/${testUnitName}.service`
    const timerPath = `${testSystemdDir}/${testUnitName}.timer`
    expect(await Bun.file(servicePath).exists()).toBe(true)
    expect(await Bun.file(timerPath).exists()).toBe(true)

    await scheduler.destroy()

    expect(await Bun.file(servicePath).exists()).toBe(false)
    expect(await Bun.file(timerPath).exists()).toBe(false)

    const status = await scheduler.getStatus()
    expect(status).toBe('inactive')
  })

  test('setup and destroy can be called multiple times', async () => {
    const servicePath = `${testSystemdDir}/${testUnitName}.service`
    const timerPath = `${testSystemdDir}/${testUnitName}.timer`

    await scheduler.setup()
    expect(await Bun.file(servicePath).exists()).toBe(true)
    expect(await Bun.file(timerPath).exists()).toBe(true)
    await scheduler.destroy()
    expect(await Bun.file(servicePath).exists()).toBe(false)
    expect(await Bun.file(timerPath).exists()).toBe(false)
    expect(await scheduler.getStatus()).toBe('inactive')

    await scheduler.setup()
    expect(await Bun.file(servicePath).exists()).toBe(true)
    expect(await Bun.file(timerPath).exists()).toBe(true)
    await scheduler.destroy()
    expect(await Bun.file(servicePath).exists()).toBe(false)
    expect(await Bun.file(timerPath).exists()).toBe(false)
    expect(await scheduler.getStatus()).toBe('inactive')
  })

  test('handles different unit names', async () => {
    const unitName = `different-scheduler-${Date.now()}`
    const differentScheduler = createSchedulerSystemd(unitName, testTickScript, testSystemdDir)

    await differentScheduler.setup()

    const servicePath = `${testSystemdDir}/${unitName}.service`
    const timerPath = `${testSystemdDir}/${unitName}.timer`

    expect(await Bun.file(servicePath).exists()).toBe(true)
    expect(await Bun.file(timerPath).exists()).toBe(true)

    await differentScheduler.destroy()

    expect(await Bun.file(servicePath).exists()).toBe(false)
    expect(await Bun.file(timerPath).exists()).toBe(false)
  })

  test('handles different tick scripts', async () => {
    const differentTickScript = '/tmp/different-tick-script.ts'
    await Bun.write(differentTickScript, '#!/usr/bin/env bun\nconsole.log("Different tick script")')
    await Bun.$`chmod +x ${differentTickScript}`

    const differentScheduler = createSchedulerSystemd(
      `script-test-scheduler-${Date.now()}`,
      differentTickScript,
      testSystemdDir
    )

    await differentScheduler.setup()
    await differentScheduler.destroy()

    await Bun.$`rm -f ${differentTickScript}`.nothrow()
  })
})
