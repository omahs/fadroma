/*
  Fadroma Build System
  Copyright (C) 2022 Hack.bg

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU Affero General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU Affero General Public License for more details.

  You should have received a copy of the GNU Affero General Public License
  along with this program.  If not, see <http://www.gnu.org/licenses/>.
**/

import * as Konzola from '@hackbg/konzola'
import * as Formati from '@hackbg/formati'
import * as Konfizi from '@hackbg/konfizi'
import * as Komandi from '@hackbg/komandi'
import * as Dokeres from '@hackbg/dokeres'
import * as Kabinet from '@hackbg/kabinet'
import $ from '@hackbg/kabinet'

import { Client, NewClient, Contract, Builder, Deployment } from '@fadroma/client'

import { default as simpleGit } from 'simple-git'

import { spawn                        } from 'child_process'
import { basename, resolve, dirname   } from 'path'
import { homedir, tmpdir              } from 'os'
import { pathToFileURL, fileURLToPath } from 'url'
import { readFileSync, mkdtempSync    } from 'fs'

export async function build (
  crates:  string[]               = [],
  ref:     string                 = 'HEAD',
  config:  Partial<BuilderConfig> = new BuilderConfig(),
  builder: Builder                = getBuilder(config)
) {
  return await builder.buildMany(crates.map(crate=>new Contract({
    gitRepo:      config.project,
    workspace: config.project,
    crate,
    ref
  })))
}

export class BuilderConfig extends Konfizi.EnvConfig {

  constructor (
    readonly env: Konfizi.Env = process.env,
    readonly cwd: string      = process.cwd(),
    defaults: Partial<BuilderConfig> = {}
  ) {
    super(env, cwd)
    this.override(defaults)
  }

  /** Project root. Defaults to current working directory. */
  project:    string
    = this.getString ('FADROMA_PROJECT',          ()=>this.cwd)
  /** Whether to bypass Docker and use the toolchain from the environment. */
  buildRaw:   boolean
    = this.getBoolean('FADROMA_BUILD_RAW',        ()=>false)
  /** Whether to ignore existing build artifacts and rebuild contracts. */
  rebuild:    boolean
    = this.getBoolean('FADROMA_REBUILD',          ()=>false)
  /** Whether not to run `git fetch` during build. */
  noFetch:    boolean
    = this.getBoolean('FADROMA_NO_FETCH',         ()=>false)
  /** Which version of the Rust toolchain to use, e.g. `1.59.0` */
  toolchain:  string
    = this.getString ('FADROMA_RUST',             ()=>'')
  /** Docker image to use for dockerized builds. */
  image:      string
    = this.getString ('FADROMA_BUILD_SCRIPT',     ()=>DockerBuilder.image)
  /** Dockerfile to build the build image if not downloadable. */
  dockerfile: string
    = this.getString ('FADROMA_BUILD_IMAGE',      ()=>DockerBuilder.dockerfile)
  /** Script that runs the actual build, e.g. build.impl.mjs */
  script:     string
    = this.getString ('FADROMA_BUILD_DOCKERFILE', ()=>LocalBuilder.script)
}

export class BuildCommands extends Deployment {

  constructor (options: Partial<BuildCommands> = {}) {
    super({ name: 'build' })
    this.config  = options.config  ?? this.config  ?? new BuilderConfig(this.env, this.cwd, options.config)
    this.builder = options.builder ?? this.builder ?? getBuilder(this.config)
    this.command('one', 'build one crate from working tree', this.buildFromPath)
  }

  /** Setting for the build context. */
  config?:   BuilderConfig

  /** Knows how to build contracts for a target. */
  builder?:  Builder

  /** Path to Cargo workspace. */
  workspace: string = process.cwd()

  /** Path to local Git repository. */
  gitRepo:   string = this.workspace

  /** Git reference from which to build sources. */
  gitRef:    string = HEAD

  /** Path to `.git` directory. */
  gitDir:    string = `${this.gitRepo}/.git`

  contract (options: Partial<Contract> = {}) {
    const { builder, gitRepo, gitRef, workspace } = this
    return super.contract(options).define({ builder, gitRepo, gitRef, workspace })
  }

  buildFromPath = (
    path: string|Kabinet.Path = process.argv[2],
    args: string[]            = process.argv.slice(3)
  ) => {
    path = $(path)
    if (path.isDirectory()) {
      return this.buildFromDirectory(path.as(Kabinet.OpaqueDirectory))
    } else if (path.isFile()) {
      return this.buildFromFile(path.as(Kabinet.OpaqueFile), args)
    } else {
      return this.printUsage()
    }
  }

  buildFromDirectory = (dir: Kabinet.OpaqueDirectory) => {
    const cargoToml = dir.at('Cargo.toml').as(Kabinet.TOMLFile)
    if (cargoToml.exists()) {
      return this.buildFromCargoToml(cargoToml as CargoTOML)
    } else {
      this.printUsage()
    }
  }

  buildFromFile = async (file: Kabinet.TOMLFile<unknown>|Kabinet.OpaqueFile, args: string[]) => {
    if (file.name === 'Cargo.toml') {
      return this.buildFromCargoToml(file as CargoTOML)
    } else {
      return this.buildFromModule(file as Kabinet.OpaqueFile, args)
    }
  }

  buildFromCargoToml = async (
    cargoToml: CargoTOML,
    gitRepo      = process.env.FADROMA_BUILD_REPO_ROOT      || cargoToml.parent,
    workspace = process.env.FADROMA_BUILD_WORKSPACE_ROOT || cargoToml.parent
  ) => {
    this.log.buildingFromCargoToml(cargoToml)
    const source = new Contract({
      gitRepo,
      workspace,
      crate: (cargoToml.as(Kabinet.TOMLFile).load() as any).package.name
    })
    try {
      (this.builder as LocalBuilder).caching = false
      const result = await this.builder!.build(source)
      const { artifact, codeHash } = result
      this.log.info('Built:    ', bold($(artifact!).shortPath))
      this.log.info('Code hash:', bold(codeHash!))
      this.exit(0)
      return result
    } catch (e) {
      this.log.error(`Build failed.`)
      this.log.error(e)
      this.exit(5)
    }
  }

  buildFromModule = async (script: Kabinet.OpaqueFile, args: string[]) => {
    this.log.buildingFromBuildScript(script, args)
    const {default: BuildCommands} = await import(script.path)
    const commands = new BuildCommands(this)
    const T0 = + new Date()
    try {
      const result = await commands.run(args)
      const T1 = + new Date()
      this.log.info(`Build finished in ${T1-T0}msec.`)
      return result
    } catch (e: any) {
      const T1 = + new Date()
      this.log.error(`Build failed in ${T1-T0}msec: ${e.message}`)
      this.log.error(e)
      throw e
    }
  }

  printUsage = () => {
    this.log.info(`
      Usage:
        fadroma-build path/to/crate
        fadroma-build path/to/Cargo.toml
        fadroma-build buildConfig.{js|ts}`)
    this.exit(6)
    return true
  }

  log = new BuildConsole(console, 'Fadroma.BuildCommands')

}

export class BuildConsole extends Komandi.CommandsConsole {
  name = 'Fadroma Build'
  buildingFromCargoToml (file: Kabinet.Path|string) {
    this.info('Building from', bold($(file).shortPath))
  }
  buildingFromBuildScript (file: Kabinet.Path, args: string[] = []) {
    this.info('Build script:', bold(file.shortPath))
    this.info('Build args:  ', bold(args.join(' ') || '(none)'))
  }
  buildingFromWorkspace (mounted: Kabinet.Path|string, ref: string = HEAD) {
    this.info(
      `Building contracts from workspace:`, bold(`${$(mounted).shortPath}/`),
      `@`, bold(ref)
    )
  }
  buildingOne (source: Contract, prebuilt: Contract|null = null) {
    if (prebuilt) {
      this.info('Reuse    ', bold($(prebuilt.artifact!).shortPath))
    } else {
      const { crate = '(unknown)', ref = 'HEAD' } = source
      this.info('Building', bold(crate), ...
        (ref === 'HEAD') ? ['from working tree'] : ['from Git reference', bold(ref)])
    }
  }
  buildingMany (sources: Contract[]) {
    for (const source of sources) {
      this.buildingOne(source, null)
    }
    this.info()
  }
}

const bold = Konzola.bold

/** Get a builder based on the builder config. */
export function getBuilder (config: Partial<BuilderConfig> = new BuilderConfig()) {
  if (config.buildRaw) {
    return new RawBuilder({ ...config, caching: !config.rebuild })
  } else {
    return new DockerBuilder({ ...config, caching: !config.rebuild })
  }
}

/** The Git reference pointing to the currently checked out working tree */
export const HEAD = 'HEAD'

//@ts-ignore
export const buildPackage = dirname(fileURLToPath(import.meta.url))

export const artifactName = (crate: string, ref: string) => `${crate}@${sanitize(ref)}.wasm`

export const sanitize = (ref: string) => ref.replace(/\//g, '_')

export const codeHashForBlob = (blob: Uint8Array) =>
  Formati.Encoding.toHex(new Formati.Crypto.Sha256(blob).digest())

export const distinct = <T> (x: T[]): T[] => [...new Set(x) as any]

export interface LocalBuilderOptions {
  /** Script that implements the actual build procedure. */
  script:        string
  /** Don't run "git fetch" during build. */
  noFetch:       boolean
  /** Name of output directory. */
  outputDirName: string
  /** Which version of the language toolchain to use. */
  toolchain:     string
  /** Whether to enable caching and reuse contracts from artifacts directory. */
  caching: boolean
}

export interface DockerBuilderOptions extends LocalBuilderOptions {
  /** Path to Docker API endpoint. */
  socketPath: string
  /** Docker API client instance. */
  docker:     Dokeres.Engine
  /** Build image. */
  image:      string|Dokeres.Image
  /** Dockerfile for building the build image. */
  dockerfile: string
}

/** Can perform builds.
  * Will only perform a build if a contract is not built yet or FADROMA_REBUILD=1 is set. */
export abstract class LocalBuilder extends Builder {

  readonly id: string = 'local'

  /** Default build script */
  static script = resolve(buildPackage, 'build.impl.mjs')

  constructor (options: Partial<LocalBuilder> = {}) {
    super()
    this.override(options)
  }

  /** The build script. */
  script:        string      = LocalBuilder.script

  /** Whether to set _NO_FETCH=1 in build script's environment and skip "git fetch" calls */
  noFetch:       boolean     = false

  /** Name of directory where build artifacts are collected. */
  outputDirName: string      = 'artifacts'

  /** Version of Rust toolchain to use. */
  toolchain:     string|null = null

  /** Whether the build process should print more detail to the console. */
  verbose:       boolean     = false

  /** Whether to enable caching. */
  caching:       boolean     = true

  /** Check if artifact exists in local artifacts cache directory.
    * If it does, don't rebuild it but return it from there. */
  protected prebuild (
    outputDir: string, crate?: string, ref: string = HEAD
  ): Contract|null {
    if (this.caching && crate) {
      const location = $(outputDir, artifactName(crate, ref))
      if (location.exists()) {
        const artifact = location.url
        const codeHash = this.codeHashForPath(location.path)
        return new Contract({ crate, ref, artifact, codeHash })
      }
    }
    return null
  }

  codeHashForPath = codeHashForPath

}

export const codeHashForPath = (location: string) => codeHashForBlob(readFileSync(location))

/** This build mode looks for a Rust toolchain in the same environment
  * as the one in which the script is running, i.e. no build container. */
export class RawBuilder extends LocalBuilder {

  readonly id = 'raw-local'

  log = new BuildConsole(console, 'Fadroma.RawBuilder')

  runtime = process.argv[0]

  /** Build a Source into a Template */
  async build (source: Contract): Promise<Contract> {
    const { workspace, gitRef = HEAD, crate } = source
    if (!workspace) throw new Error('no workspace')
    if (!crate)     throw new Error('no crate')

    // Temporary dirs used for checkouts of non-HEAD builds
    let tmpGit, tmpBuild

    // Most of the parameters are passed to the build script
    // by way of environment variables.
    const env = {
      _BUILD_GID: process.getgid(),
      _BUILD_UID: process.getuid(),
      _OUTPUT:    $(workspace).in('artifacts').path,
      _REGISTRY:  '',
      _TOOLCHAIN: this.toolchain,
    }

    if ((gitRef ?? HEAD) !== HEAD) {
      const gitDir = getGitDir(source)
      // Provide the build script with the config values that ar
      // needed to make a temporary checkout of another commit
      if (!gitDir?.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
      // Create a temporary Git directory. The build script will copy the Git history
      // and modify the refs in order to be able to do a fresh checkout with submodules
      tmpGit   = $(mkdtempSync($(tmpdir(), 'fadroma-git-').path))
      tmpBuild = $(mkdtempSync($(tmpdir(), 'fadroma-build-').path))
      Object.assign(env, {
        _GIT_ROOT:   gitDir.path,
        _GIT_SUBDIR: gitDir.isSubmodule ? gitDir.submoduleDir : '',
        _NO_FETCH:   this.noFetch,
        _TMP_BUILD:  tmpBuild.path,
        _TMP_GIT:    tmpGit.path,
      })
    }

    // Run the build script
    const cmd = [this.runtime, this.script, 'phase1', gitRef, crate ]
    const opts = { cwd: source.workspace, env: { ...process.env, ...env }, stdio: 'inherit' }
    const sub  = spawn(cmd.shift() as string, cmd, opts as any)
    await new Promise<void>((resolve, reject)=>{
      sub.on('exit', (code: number, signal: any) => {
        const build = `Build of ${source.crate} from ${$(source.workspace!).shortPath} @ ${source.gitRef}`
        if (code === 0) {
          resolve()
        } else if (code !== null) {
          const message = `${build} exited with code ${code}`
          this.log.error(message)
          throw Object.assign(new Error(message), { source, code })
        } else if (signal !== null) {
          const message = `${build} exited by signal ${signal}`
          this.log.warn(message)
        } else {
          throw new Error('Unreachable')
        }
      })
    })

    // If this was a non-HEAD build, remove the temporary Git dir used to do the checkout
    if (tmpGit   && tmpGit.exists())   tmpGit.delete()
    if (tmpBuild && tmpBuild.exists()) tmpBuild.delete()

    // Create an artifact for the build result
    const location = $(env._OUTPUT, artifactName(crate, sanitize(gitRef)))
    this.log.info('Build ok:', bold(location.shortPath))
    return Object.assign(new Contract(source), {
      artifact: pathToFileURL(location.path),
      codeHash: this.codeHashForPath(location.path)
    })
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: Contract[]): Promise<Contract[]> {
    const templates: Contract[] = []
    for (const source of inputs) templates.push(await this.build(source))
    return templates
  }

}

/** This builder launches a one-off build container using Dockerode. */
export class DockerBuilder extends LocalBuilder {

  readonly id = 'docker-local'

  static image = 'ghcr.io/hackbg/fadroma:unstable'

  static dockerfile = resolve(buildPackage, 'build.Dockerfile')

  constructor (opts: Partial<DockerBuilderOptions> = {}) {
    super(opts)
    // Set up Docker API handle
    if (opts.socketPath) {
      this.docker = new Dokeres.Engine(this.socketPath = opts.socketPath)
    } else if (opts.docker) {
      this.docker = opts.docker
    }
    if (opts.image instanceof Dokeres.Image) {
      this.image = opts.image
    } else if (opts.image) {
      this.image = new Dokeres.Image(this.docker, opts.image)
    } else {
      this.image = new Dokeres.Image(this.docker, 'ghcr.io/hackbg/fadroma:unstable')
    }
    // Set up Docker image
    this.dockerfile ??= opts.dockerfile!
    this.script     ??= opts.script!
  }

  log = new BuildConsole(console, 'Fadroma.DockerBuilder')

  /** Used to launch build container. */
  socketPath: string  = '/var/run/docker.sock'

  /** Used to launch build container. */
  docker:     Dokeres.Engine = new Dokeres.Engine(this.socketPath)

  /** Tag of the docker image for the build container. */
  image:      Dokeres.Image

  /** Path to the dockerfile to build the build container if missing. */
  dockerfile: string

  /** Build a Source into a Template */
  async build (source: Contract): Promise<Contract> {
    return (await this.buildMany([source]))[0]
  }

  /** This implementation groups the passed source by workspace and ref,
    * in order to launch one build container per workspace/ref combination
    * and have it build all the crates from that combination in sequence,
    * reusing the container's internal intermediate build cache. */
  async buildMany (inputs: Contract[]): Promise<Contract[]> {

    const longestCrateName = inputs
      .map(source=>source.crate?.length||0)
      .reduce((x,y)=>Math.max(x,y),0)

    for (const source of inputs) {
      const { gitRepo, gitRef, crate } = source
      if (!gitRepo) throw new Error('missing source.gitRepo')
      const outputDir = $(gitRepo).resolve(this.outputDirName)
      const prebuilt  = this.prebuild(outputDir, crate, gitRef)
      this.log.buildingOne(source, prebuilt)
    }

    // Collect a mapping of workspace path -> Workspace object
    const workspaces: Record<string, Contract> = {}
    for (const source of inputs) {
      const { gitRepo, gitRef, workspace } = source
      const gitDir = getGitDir(source)
      if (!gitRepo) throw new Error('missing source.gitRepo')
      if (!workspace) throw new Error('missing source.workspace')
      workspaces[workspace] = new Contract(workspace)
      // No way to checkout non-`HEAD` ref if there is no `.git` dir
      console.log('->',source)
      if (gitRef !== HEAD && !gitDir?.present) {
        const error = new Error("Fadroma Build: could not find Git directory for source.")
        throw Object.assign(error, { source })
      }
    }

    // Here we will collect the build outputs
    const outputs: Contract[] = inputs.map(input=>new Contract({ ...input, builder: this }))

    // Get the distinct workspaces and refs by which to group the crate builds
    const roots:   string[] = distinct(inputs.map(source=>source.workspace!))
    const gitRefs: string[] = distinct(inputs.map(source=>source.gitRef??HEAD))

    // For each workspace/ref pair
    for (const path of roots) for (const gitRef of gitRefs) {
      await buildFor.call(this, path, gitRef)
    }

    return outputs

    const self = this
    async function buildFor (this: typeof self, path: string, gitRef: string) {
      let mounted = $(path)
      if (this.verbose) this.log.buildingFromWorkspace(mounted, gitRef)
      if (gitRef !== HEAD) {
        const gitDir = getGitDir(workspaces[path])
        mounted = gitDir.rootRepo
        //console.info(`Using history from Git directory: `, bold(`${mounted.shortPath}/`))
        await simpleGit(gitDir.path)
          .fetch(process.env.FADROMA_PREFERRED_REMOTE || 'origin')
      }
      // Create a list of sources for the container to build,
      // along with their indices in the input and output arrays
      // of this function.
      const crates: [number, string][] = []
      for (let index = 0; index < inputs.length; index++) {
        const source = inputs[index]
        if (source.workspace === path && source.gitRef === gitRef) {
          crates.push([index, source.crate!])
        }
      }
      // Build the crates from each same workspace/gitRef pair and collect the results.
      // sequentially in the same container.
      // Collect the templates built by the container
      const results = await this.runBuildContainer(
        mounted.path,
        mounted.relative(path),
        gitRef,
        crates,
        (gitRef !== HEAD)
          ? (gitDir=>gitDir.isSubmodule?gitDir.submoduleDir:'')(getGitDir(workspaces[path]))
          : ''
      )
      for (const index in results) {
        if (!results[index]) continue
        outputs[index] = new Contract({ ...results[index], ...inputs[index] })
      }
    }

  }

  protected async runBuildContainer (
    root:      string,
    subdir:    string,
    gitRef:       string,
    crates:    [number, string][],
    gitSubdir: string = '',
    outputDir: string = $(root, subdir, this.outputDirName).path,
  ): Promise<(Contract|null)[]> {
    // Create output directory as user if it does not exist
    $(outputDir).as(Kabinet.OpaqueDirectory).make()

    // Output slots. Indices should correspond to those of the input to buildMany
    const templates:   (Contract|null)[] = crates.map(()=>null)

    // Whether any crates should be built, and at what indices they are in the input and output.
    const shouldBuild: Record<string, number> = {}

    // Collect cached templates. If any are missing from the cache mark them as buildable.
    for (const [index, crate] of crates) {
      const prebuilt = this.prebuild(outputDir, crate, gitRef)
      if (prebuilt) {
        const location = $(prebuilt.artifact!).shortPath
        //console.info('Exists, not rebuilding:', bold($(location).shortPath))
        templates[index] = prebuilt
      } else {
        shouldBuild[crate] = index
      }
    }

    // If there are no templates to build, this means everything was cached and we're done.
    if (Object.keys(shouldBuild).length === 0) {
      return templates
    }

    // Define the mounts and environment variables of the build container
    const buildScript   = `/${basename(this.script)}`
    const safeRef       = sanitize(gitRef)
    const knownHosts    = $(`${homedir()}/.ssh/known_hosts`)
    const etcKnownHosts = $(`/etc/ssh/ssh_known_hosts`)
    const readonly = {
      // The script that will run in the container
      [this.script]:                buildScript,
      // Root directory of repository, containing real .git directory
      [$(root).path]:              `/src`,
      // For non-interactively fetching submodules over SSH, we need to propagate known_hosts
      ...(knownHosts.isFile()    ? { [knownHosts.path]:     '/root/.ssh/known_hosts'   } : {}),
      ...(etcKnownHosts.isFile() ? { [etcKnownHosts.path] : '/etc/ssh/ssh_known_hosts' } : {}),
    }

    // For fetching from private repos, we need to give the container access to ssh-agent
    if (process.env.SSH_AUTH_SOCK) readonly[process.env.SSH_AUTH_SOCK] = '/ssh_agent_socket'
    const writable = {
      // Output path for final artifacts
      [outputDir]:                  `/output`,
      // Persist cache to make future rebuilds faster. May be unneccessary.
      //[`project_cache_${safeRef}`]: `/tmp/target`,
      [`cargo_cache_${safeRef}`]:   `/usr/local/cargo`
    }

    // Since Fadroma can be included as a Git submodule, but
    // Cargo doesn't support nested workspaces, Fadroma's
    // workpace root manifest is renamed to _Cargo.toml.
    // Here we can mount it under its proper name
    // if building the example contracts from Fadroma.
    if (process.env.FADROMA_BUILD_WORKSPACE_MANIFEST) {
      if (gitRef !== HEAD) {
        throw new Error(
          'Fadroma Build: FADROMA_BUILD_WORKSPACE_ROOT can only' +
          'be used when building from working tree'
        )
      }
      writable[$(root).path] = readonly[$(root).path]
      delete readonly[$(root).path]
      readonly[$(process.env.FADROMA_BUILD_WORKSPACE_MANIFEST).path] = `/src/Cargo.toml`
    }

    // Variables used by the build script are prefixed with underscore
    // and variables used by the tools used by the build script are left as is
    const env = {
      _BUILD_USER:                  process.env.FADROMA_BUILD_USER || 'fadroma-builder',
      _BUILD_UID:                   process.env.FADROMA_BUILD_UID  || process.getuid(),
      _BUILD_GID:                   process.env.FADROMA_BUILD_GID  || process.getgid(),
      _GIT_REMOTE:                  process.env.FADROMA_PREFERRED_REMOTE||'origin',
      _GIT_SUBDIR:                  gitSubdir,
      _SUBDIR:                      subdir,
      _NO_FETCH:                    this.noFetch,
      CARGO_HTTP_TIMEOUT:           '240',
      CARGO_NET_GIT_FETCH_WITH_CLI: 'true',
      GIT_PAGER:                    'cat',
      GIT_TERMINAL_PROMPT:          '0',
      LOCKED:                       '',/*'--locked'*/
      SSH_AUTH_SOCK:                '/ssh_agent_socket',
      TERM:                         process.env.TERM,
    }

    // Pre-populate the list of expected artifacts.
    const outputWasms: Array<string|null> = [...new Array(crates.length)].map(()=>null)
    for (const [crate, index] of Object.entries(shouldBuild)) {
      outputWasms[index] = $(outputDir, artifactName(crate, safeRef)).path
    }

    // Pass the compacted list of crates to build into the container
    const cratesToBuild = Object.keys(shouldBuild)
    const command = [ 'node', buildScript, 'phase1', gitRef, ...cratesToBuild ]
    const extra   = { Tty: true, AttachStdin: true, }
    const options = { remove: true, readonly, writable, cwd: '/src', env, extra }

    //console.info('Building with command:', bold(command.join(' ')))
    //console.debug('Building in a container with this configuration:', options)
    // Prepare the log output stream
    const buildLogPrefix = `[${gitRef}]`.padEnd(16)
    const transformLine  = (line:string)=>`[Fadroma Build] ${buildLogPrefix} ${line}`
    const logs = new Dokeres.LineTransformStream(transformLine)
    logs.pipe(process.stdout)

    // Run the build container
    const rootName       = sanitize(basename(root))
    const buildName      = `fadroma-build-${rootName}@${gitRef}`
    const buildContainer = await this.image.run(buildName, options, command, '/usr/bin/env', logs)
    const {Error: err, StatusCode: code} = await buildContainer.wait()

    // Throw error if launching the container failed
    if (err) {
      throw new Error(`[@fadroma/build] Docker error: ${err}`)
    }

    // Throw error if the build failed
    if (code !== 0) {
      const crateList = cratesToBuild.join(' ')
      this.log.error(
        'Build of crates:',   bold(crateList),
        'exited with status', bold(code)
      )
      throw new Error(
        `[@fadroma/build] Build of crates: "${crateList}" exited with status ${code}`
      )
    }

    // Return a sparse array of the resulting artifacts
    return outputWasms.map(location =>
      (location === null) ? null : new Contract({
        artifact: $(location).url,
        codeHash: this.codeHashForPath(location)
      }))

  }

}

export function getGitDir ({ gitRepo }: Partial<Contract> = {}): DotGit {
  if (!gitRepo) throw new Error('Contract: no path when trying to access gitDir')
  return new DotGit(gitRepo)
}

/** Represents the real location of the Git data directory.
  * - In standalone repos this is `.git/`
  * - If the contracts workspace repository is a submodule,
  *   `.git` will be a file containing e.g. "gitdir: ../.git/modules/something" */
export class DotGit extends Kabinet.Path {

  /* Matches "/.git" or "/.git/" */
  static rootRepoRE = new RegExp(`${Kabinet.Path.separator}.git${Kabinet.Path.separator}?`)

  constructor (base: string|URL, ...fragments: string[]) {

    if (base instanceof URL) base = fileURLToPath(base)

    super(base, ...fragments, '.git')

    if (!this.exists()) {
      // If .git does not exist, it is not possible to build past commits
      this.log.warn(bold(this.shortPath), 'does not exist')
      this.present = false

    } else if (this.isFile()) {
      // If .git is a file, the workspace is contained in a submodule
      const gitPointer = this.as(Kabinet.TextFile).load().trim()
      const prefix = 'gitdir:'
      if (gitPointer.startsWith(prefix)) {
        // If .git contains a pointer to the actual git directory,
        // building past commits is possible.
        const gitRel  = gitPointer.slice(prefix.length).trim()
        const gitPath = $(this.parent, gitRel).path
        const gitRoot = $(gitPath)
        //this.log.info(bold(this.shortPath), 'is a file, pointing to', bold(gitRoot.shortPath))
        this.path      = gitRoot.path
        this.present   = true
        this.isSubmodule = true
      } else {
        // Otherwise, who knows?
        this.log.info(bold(this.shortPath), 'is an unknown file.')
        this.present = false
      }

    } else if (this.isDirectory()) {
      // If .git is a directory, this workspace is not in a submodule
      // and it is easy to build past commits
      this.present = true

    } else {
      // Otherwise, who knows?
      this.log.warn(bold(this.shortPath), `is not a file or directory`)
      this.present = false
    }

  }

  log = new BuildConsole(console, 'Fadroma.DotGit')

  readonly present:     boolean

  readonly isSubmodule: boolean = false

  get rootRepo (): Kabinet.Path {
    return $(this.path.split(DotGit.rootRepoRE)[0])
  }

  get submoduleDir (): string {
    return this.path.split(DotGit.rootRepoRE)[1]
  }

}

type CargoTOML = Kabinet.TOMLFile<{ package: { name: string } }>

export default new BuildCommands()
