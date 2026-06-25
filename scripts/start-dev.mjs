import { openSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawn } from 'node:child_process'

const root = resolve(import.meta.dirname, '..')

function start(name, args, logName) {
  const out = openSync(join(root, logName), 'w')
  const err = openSync(join(root, logName.replace('.log', '.err.log')), 'w')
  const child = spawn('C:\\Program Files\\nodejs\\npm.cmd', args, {
    cwd: root,
    detached: true,
    stdio: ['ignore', out, err],
    windowsHide: true,
  })
  child.unref()
  console.log(`${name}: ${child.pid}`)
}

start('web', ['run', 'dev:web'], '.codex-web.log')
start('api', ['run', 'dev:api'], '.codex-api.log')
