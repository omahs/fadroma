import { prompts, colors, bold } from '@hackbg/konzola'
import { Path, TextFile, JSONFile, YAMLFile } from '@hackbg/kabinet'
import { execSync } from 'child_process'
import pkg from '../package.json'

async function create () {
  console.log(' ', bold('Fadroma:'), String(pkg.version).trim())
  check('Git:    ', 'git --version')
  check('Node:   ', 'node --version')
  check('NPM:    ', 'npm --version')
  check('Yarn:   ', 'yarn --version')
  check('PNPM:   ', 'pnpm --version')
  check('Cargo:  ', 'cargo --version')
  check('Docker: ', 'docker --version')
  check('Nix:    ', 'nix --version')
  const project   = await askProjectName()
  const contracts = await askContractNames()
  const root      = await setupRoot(project, contracts)
  setupGit(root)
  setupNode(root, project, contracts)
  setupCargoWorkspace(root, project, contracts)
  setupApiCrate(root, project, contracts)
  setupSharedCrate(root, project, contracts)
  setupContractCrates(root, project, contracts)
  //await setupDrone(root) // TODO
  //await setupGHA(root)   // TODO
  //await setupNix(root)   // TODO
  await setupFadroma(root)
}

function check (dependency, command) {
  let version = null
  try {
    const version = execSync(command)
    console.log(' ', bold(dependency), String(version).trim())
  } catch (e) {
    console.log(' ', bold(dependency), colors.yellow('(not found)'))
  } finally {
    return version
  }
}

async function askProjectName () {
  return await prompts.text({
    type:    'text',
    name:    'projectName',
    message: 'Enter a project name (lowercase alphanumerics only)'
  })
}

async function askContractNames () {
  let action: 'add'|'remove'|'done' = 'add'
  const contracts = new Set()
  while (true) {
    if (action === 'add') {
      const name = await prompts.text({
        type:    'text',
        name:    'projectName',
        message: 'Enter a contract name (lowercase alphanumerics only)'
      })
      if (name === 'lib') {
        console.info('"lib" is a reserved name. Try something else.')
        continue
      }
      contracts.add(name)
    }
    console.log(' ', bold('Contracts that will be created:'))
    for (const contractName of [...contracts].sort()) {
      console.log('  -', contractName)
    }
    action = await prompts.select({
      type:    'select',
      name:    'contractAction',
      message: 'Add more contracts?',
      choices: [
        { title: 'Add another contract', value: 'add' },
        ...(contracts.size > 0) ? [{ title: 'Remove a contract', value: 'remove' }] : [],
        { title: 'Done, create project!', value: 'done' },
      ]
    })
    if (action === 'done') {
      return contracts
    } else if (action === 'remove') {
      contracts.delete(await prompts.select({
        type:    'select',
        name:    'contractAction',
        message: 'Select contract to remove:',
        choices: [...contracts].map(name=>({
          title: name, value: name
        }))
      }))
    }
  }
  return contracts
}

async function setupRoot (name, contracts) {
  const root = new Path(process.cwd()).in(name)
  if (root.exists) {
    console.log(`\n  ${name}: already exists.`)
    console.log(`  Move it out of the way, or pick a different name.`)
    process.exit(1)
  }
  root.make()
  return root
}

function setupGit (root) {
  execSync('git init -b main', { cwd: root.path })
  root.at('.gitignore').as(TextFile).save(``)
}

function setupNode (root, project, contracts) {
  root.at('package.json').as(JSONFile).save({
    name:    `@${project}/workspace`,
    version: '0.1.0',
    private: true
  })
  root.in('api').at('package.json').as(JSONFile).save({
    name:    `@${project}/api`,
    version: '0.1.0',
    dependencies: {
      '@fadroma/client': '^2'
    }
  })
  for (const contract of contracts) {
    const Contract = contract[0].toUpperCase() + contract.slice(1)
    root.in('api').at(`${contract}.ts`).as(TextFile).save(dedent(`
      // Client for contract: ${contract}
      import { Client } from '@fadroma/client'
      class ${Contract} extends Client {
        fees = {}
        // See https://fadroma.tech/guides/client-classes
      }
    `))
  }
}

function setupCargoWorkspace (root, project, contracts) {
  root.at('Cargo.toml').as(TextFile).save(dedent(`
    [workspace]
    members = [
      "./api",
      "./shared",
      ${[...contracts].map(name=>`"./contracts/${name};`).join('      \n')}
    ]

    [profile.release]
    codegen-units    = 1
    debug            = false
    debug-assertions = false
    incremental      = false
    lto              = true
    opt-level        = 3
    overflow-checks  = true
    panic            = 'abort'
    rpath            = false
  `))
}

function setupApiCrate (root, project, contracts) {
  root.in('api').at('Cargo.toml').as(TextFile).save(dedent(`
    [package]
    name = "${project}-api"

    [lib]
    path = "lib.rs"

    [dependencies]
    schemars = "0.7"
    serde    = { version = "1.0.103", default-features = false, features = ["derive"] }
  `))
  root.in('api').at('lib.rs').as(TextFile).save(dedent(`
    // Messages of contracts are defined in this crate.
    ${[...contracts].map(name=>`pub mod ${name};`).join('    \n')}
  `))
  for (const contract of contracts) {
    root.in('api').at(`${contract}.rs`).as(TextFile).save(dedent(`
      // API definition for contract: ${contract}
      pub struct Init {}
      pub enum Handle {}
      pub enum Query {}
    `))
  }
}

function setupSharedCrate (root, project, contracts) {
  // Create the Shared crate
  root.in('shared').at('Cargo.toml').as(TextFile).save(dedent(`
    [package]
    name = "${project}-shared"

    [lib]
    path = "lib.rs"

    [dependencies]
  `))
  root.in('shared').at('lib.rs').as(TextFile).save(dedent(`
    # Entities defined here can be accessed from any contract without circular dependencies.
  `))
}

function setupContractCrates (root, project, contracts) {
  for (const contract of [...contracts]) {
    root.in('contracts').in(contract).at('Cargo.toml').as(TextFile).save(dedent(`
      [package]
      name    = "${contract}"
      version = "0.1.0"
      edition = "2018"

      [lib]
      crate-type = ["cdylib", "rlib"]
      doctest    = false
      path       = "${contract}.rs"

      [dependencies]
      fadroma  = { path = "../../../fadroma/crates/fadroma", features = ["scrt"] }
    `))
    root.in('contracts').in(contract).at(`${contract}.rs`).as(TextFile).save(dedent(`
    `))
  }
}

function setupFadroma (root) {
  root.at('fadroma.yml').as(YAMLFile).save()
}

//function foo () {
  //process.chdir(name)
  //await mkdirp("artifacts")
  //await mkdirp("contracts")
  //await mkdirp("contracts/hello")
  //await mkdirp("contracts/hello/tests")
  //await mkdirp("receipts")
  //await mkdirp("scripts")
  //await mkdirp("settings")

  //// create project content
  //await Promise.all([
    //writeFile('.gitignore', '', 'utf8'),
    //writeFile('Cargo.toml', '', 'utf8'),
    //writeFile('README.md',  '', 'utf8'),
    //writeFile('package.json',        '', 'utf8'),
    //writeFile('pnpm-workspace.yaml', '', 'utf8'),
    //writeFile('shell.nix',           '', 'utf8'),
    //writeFile('tsconfig.json',       '', 'utf8'),

    //writeFile('contracts/hello/Cargo.toml',   '', 'utf8'),
    //writeFile('contracts/hello/api.ts',       '', 'utf8'),
    //writeFile('contracts/hello/hello.rs',     '', 'utf8'),
    //writeFile('contracts/hello/package.json', '', 'utf8'),
    //writeFile('contracts/hello/tests/mod.rs', '', 'utf8'),

    //writeFile('scripts/Dev.ts.md',   '', 'utf8'),
    //writeFile('scripts/Ops.ts.md',   '', 'utf8'),
  //])

  //console.log('\n  Project created.')

  //// create /README.md
  //// create /package.json
  //// create /tsconfig.json
  //// create /pnpm-workspace.yaml
  //// create /shell.nix
  //// create /scripts/Dev.ts.md
  //// create /scripts/Ops.ts.md
  //// create /Cargo.toml
  //// create /contracts/hello/Cargo.toml
  //// create /contracts/hello/package.json
  //// create /contracts/hello/hello.rs
  //// create /contracts/hello/api.ts
  //// create /contracts/hello/tests/mod.ts
  //// create /artifacts
  //// create /receipts
  //// run cargo build
  //// git init
  //// git commit
//}

const RE_NON_WS = /\S|$/

function dedent (string) {
  let minWS = Infinity
  const lines = string.split('\n')
  for (const line of lines) {
    if (line.trim().length === 0) continue // don't take into account blank lines
    minWS = Math.min(minWS, line.search(RE_NON_WS))
  }
  const dedentedMessage = lines.map(line=>line.slice(minWS)).join('\n')
  return dedentedMessage.trim()
}

create()
