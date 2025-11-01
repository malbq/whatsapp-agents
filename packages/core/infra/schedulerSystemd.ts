import type { Scheduler } from './scheduler'

const ON_BOOT_SEC = '30s'
const ON_UNIT_ACTIVE_SEC = '60s'
const ACCURACY_SEC = '10s'
const EXEC = 'bun'

//const logger = getLogger(['infra', 'scheduler', 'systemd'])

function serviceUnitPath(unitName: string, basePath = '/etc/systemd/system') {
  return `${basePath}/${unitName}.service`
}

function timerUnitPath(unitName: string, basePath = '/etc/systemd/system') {
  return `${basePath}/${unitName}.timer`
}

function buildServiceUnit(tickScript: string) {
  const envLines = Object.entries(import.meta.env)
    .map(([key, value]) => `Environment="${key}=${value}"`)
    .join('\n')
  return `[Unit]
Description=Whatsapp Assistant Scheduler Service
After=network-online.target

[Service]
Type=oneshot
User=${process.env.USER}
WorkingDirectory=${process.cwd()}
${envLines}
ExecStart=${EXEC} run ${tickScript}

[Install]
WantedBy=multi-user.target`
}

function buildTimerUnit(unitName: string) {
  return `[Unit]
Description=Whatsapp Assistant Scheduler Timer

[Timer]
OnBootSec=${ON_BOOT_SEC}
OnUnitActiveSec=${ON_UNIT_ACTIVE_SEC}
AccuracySec=${ACCURACY_SEC}
Unit=${unitName}.service

[Install]
WantedBy=timers.target`
}

async function systemctlReload() {
  await Bun.$`sudo systemctl daemon-reload`.nothrow()
  console.log('Systemd daemon reloaded')
}

async function systemctlEnableStartTimer(unitName: string) {
  await Bun.$`sudo systemctl enable --now ${unitName}.timer`.nothrow()
  console.log('Systemd timer enabled and started')
}

async function systemctlDisableStopTimer(unitName: string) {
  await Bun.$`sudo systemctl disable --now ${unitName}.timer`.nothrow()
  console.log('Systemd timer disabled and stopped')
}

export function createSchedulerSystemd(
  unitName: string,
  tickScript: string,
  basePath = '/etc/systemd/system'
): Scheduler {
  const isProduction = basePath === '/etc/systemd/system'

  return {
    async setup() {
      console.log('Installing systemd scheduler')

      const serviceUnit = buildServiceUnit(tickScript)
      const timerUnit = buildTimerUnit(unitName)

      const servicePath = serviceUnitPath(unitName, basePath)
      const timerPath = timerUnitPath(unitName, basePath)

      console.debug('Generated service unit', { path: servicePath })
      console.debug('Generated timer unit', { path: timerPath })

      try {
        if (isProduction) {
          await Bun.write(servicePath, serviceUnit)
          await Bun.write(timerPath, timerUnit)
        } else {
          // For testing, write without sudo
          await Bun.write(servicePath, serviceUnit)
          await Bun.write(timerPath, timerUnit)
        }
        console.log('Service unit file written', { path: servicePath })
        console.log('Timer unit file written', { path: timerPath })

        if (isProduction) {
          await systemctlReload()
          await systemctlEnableStartTimer(unitName)
        }

        console.log('Systemd scheduler installation completed successfully')
      } catch (error) {
        console.error('Failed to install systemd scheduler', {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    async destroy() {
      console.log('Uninstalling systemd scheduler')

      try {
        if (isProduction) {
          await systemctlDisableStopTimer(unitName)
        }

        const servicePath = serviceUnitPath(unitName, basePath)
        const timerPath = timerUnitPath(unitName, basePath)

        if (isProduction) {
          await Bun.$`sudo rm -f ${servicePath}`.nothrow()
          await Bun.$`sudo rm -f ${timerPath}`.nothrow()
          await systemctlReload()
        } else {
          // For testing, remove without sudo
          await Bun.$`rm -f ${servicePath}`.nothrow()
          await Bun.$`rm -f ${timerPath}`.nothrow()
        }
        console.log('Service unit file removed', { path: servicePath })
        console.log('Timer unit file removed', { path: timerPath })

        console.log('Systemd scheduler uninstallation completed successfully')
      } catch (error) {
        console.error('Failed to uninstall systemd scheduler', {
          error: error instanceof Error ? error.message : String(error),
        })
        throw error
      }
    },
    async getStatus() {
      if (!isProduction) {
        // In test environment, systemctl commands don't work
        return 'inactive'
      }

      try {
        const enabledResult = await Bun.$`systemctl is-enabled ${unitName}.timer`.nothrow()
        const isEnabled = enabledResult.exitCode === 0 && enabledResult.text().trim() === 'enabled'
        if (!isEnabled) {
          return 'inactive'
        }

        const timerResult = await Bun.$`systemctl is-active ${unitName}.timer`.nothrow()
        const isActive = timerResult.exitCode === 0 && timerResult.text().trim() === 'active'
        if (isActive) {
          return 'running'
        }

        return 'stopped'
      } catch (error) {
        console.error('Failed to get systemd scheduler status', {
          error: error instanceof Error ? error.message : String(error),
        })
        return 'inactive'
      }
    },
  }
}
