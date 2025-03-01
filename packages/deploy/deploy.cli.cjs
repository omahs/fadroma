#!/usr/bin/env node

const exit = {
  ok () {
    process.exit(0)
  },
  async scriptError (e) {
    const {Console} = await import('@hackbg/logs')
    const log = new Console('@fadroma/deploy: cli')
    log.error(e.message)
    for (const key in e) {
      if (key === 'message' || key === 'stack' || key === 'txBytes') continue
      log.error(`  ${(key+':').padEnd(18)} ${e[key]}`)
    }
    log.error(`\n${e.stack}`)
    process.exit(1)
  },
  noScript () {
    console.error('Pass a deploy script.')
    process.exit(2)
  },
  importError (scriptPath, e) {
    console.error('Failed to load', scriptPath)
    console.error(e)
    process.exit(3)
  },
  noEntrypoint (script) {
    console.error(
      `${script} has no default export.\n` +
      `Export a default function to serve as entrypoint to your deploy script, e.g.:\n\n`+
      `  import { Deployer } from '@fadroma/deploy'\n`+
      `  class MyDeployment extends Deployer {\n` +
      `    /* ... implementation ... */\n` +
      `  }` +
      `  export default MyDeployment.run()`
    )
    process.exit(4)
  },
}

if (process.env.Fadroma) {
  // Call the default export of the deploy script
  const script = process.argv[2]
  if (!script) exit.noScript()
  console.log()
  const scriptPath = require('path').resolve(process.cwd(), script)
  import(scriptPath).then(
    async ({ default: entrypoint })=>{
      if (!entrypoint) exit.noEntrypoint(script)
      await Promise.resolve(entrypoint(process.argv.slice(3))).catch(exit.scriptError)
    },
    e => exit.importError(scriptPath, e)
  )
} else {
  // Trampoline to the entry point of Komandi, which then trampolines
  // back to this script with TypeScript support enabled by Ganesha
  process.env.Fadroma = true
  require('@hackbg/cmds/cmds.cli.cjs')
}
