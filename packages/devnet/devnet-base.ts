import { EnvConfig } from '@hackbg/conf'
import { CommandContext } from '@hackbg/cmds'
import $, { OpaqueDirectory, JSONFile } from '@hackbg/file'
import { AgentOpts, Chain, ChainId, DevnetHandle } from '@fadroma/core'
import { DevnetError as Error, DevnetConsole as Console } from './devnet-events'

/** Supported devnet variants. */
export type DevnetPlatform =
  |'scrt_1.2'
  |'scrt_1.3'
  |'scrt_1.4'
  |'scrt_1.5'
  |'scrt_1.6'
  |'scrt_1.7'

/** Supported connection types. */
export type DevnetPortMode = 'lcp'|'grpcWeb'

/** Gets devnet settings from environment. */
export class DevnetConfig extends EnvConfig {
  /** URL to the devnet manager endpoint, if used. */
  manager:   string|null = this.getString ('FADROMA_DEVNET_MANAGER',   ()=>null)
  /** Whether to remove the devnet after the command ends. */
  ephemeral: boolean     = this.getBoolean('FADROMA_DEVNET_EPHEMERAL', ()=>false)
  /** Chain id for devnet .*/
  chainId:   string      = this.getString ('FADROMA_DEVNET_CHAIN_ID',  ()=>"fadroma-devnet")
  /** Host for devnet. */
  host:      string|null = this.getString ('FADROMA_DEVNET_HOST',      ()=>null)
  /** Port for devnet. */
  port:      string|null = this.getString ('FADROMA_DEVNET_PORT',      ()=>null)
}

/** A Devnet is created from a given chain ID with given pre-configured identities,
  * and its state is stored in a given directory (e.g. `receipts/fadroma-devnet`). */
export interface DevnetOpts {
  /** Internal name that will be given to chain. */
  chainId?:    string
  /** Names of genesis accounts to be created with the node */
  identities?: Array<string>
  /** Path to directory where state will be stored. */
  stateRoot?:  string,
  /** Host to connect to. */
  host?:       string
  /** Port to connect to. */
  port?:       number
  /** Which of the services should be exposed the devnet's port. */
  portMode?:   DevnetPortMode
  /** Whether to destroy this devnet on exit. */
  ephemeral?:  boolean
}

/** Used to reconnect between runs. */
export interface DevnetState {
  /** ID of Docker container to restart. */
  containerId?: string
  /** Chain ID that was set when creating the devnet. */
  chainId:      string
  /** The port on which the devnet will be listening. */
  host?:        string
  /** The port on which the devnet will be listening. */
  port:         number|string
}

/** Default connection type to expose on each devnet variant. */
export const devnetPortModes: Record<DevnetPlatform, DevnetPortMode> = {
  'scrt_1.2': 'lcp',
  'scrt_1.3': 'grpcWeb',
  'scrt_1.4': 'grpcWeb',
  'scrt_1.5': 'lcp',
  'scrt_1.6': 'lcp',
  'scrt_1.7': 'lcp'
}

/** An ephemeral private instance of a network. */
export abstract class Devnet extends CommandContext implements DevnetHandle {

  /** Create an object representing a devnet.
    * Must call the `respawn` method to get it running. */
  constructor ({
    chainId,
    identities,
    stateRoot,
    host,
    port,
    portMode,
    ephemeral
  }: Partial<DevnetOpts> = {}) {
    super('devnet')
    this.chainId = chainId ?? this.chainId
    if (!this.chainId) throw new Error.NoChainId()

    // FIXME: Is the auto-destroy working?
    this.ephemeral = ephemeral ?? this.ephemeral

    // Define connection method
    this.host     = host ?? this.host
    this.portMode = portMode! // this should go, in favor of exposing all ports
    this.port     = port ?? ((this.portMode === 'lcp') ? 1317 : 9091)

    // Define initial wallets
    this.genesisAccounts = identities ?? this.genesisAccounts

    // Define storage
    this.stateRoot = $(stateRoot || $('receipts', this.chainId).path).as(OpaqueDirectory)
    this.nodeState = this.stateRoot.at('node.json').as(JSONFile) as JSONFile<DevnetState>

    // Define CLI commands
    this.addCommand('reset',  'kill and erase the devnet', () => {})
    this.addCommand('stop',   'gracefully pause the devnet', () => {})
    this.addCommand('kill',   'terminate the devnet immediately', () => {})
    this.addCommand('export', 'stop the devnet and save it as a new Docker image', () => {})
  }

  /** Logger. */
  log: Console = log

  /** Whether to destroy this devnet on exit. */
  ephemeral: boolean = false

  /** The chain ID that will be passed to the devnet node. */
  chainId: ChainId = 'fadroma-devnet'

  /** The protocol of the API URL without the trailing colon. */
  protocol: string = 'http'

  /** The hostname of the API URL. */
  host: string = process.env.FADROMA_DEVNET_HOST ?? 'localhost'

  /** The port of the API URL. If `null`, `freePort` will be used to obtain a random port. */
  port: number

  /** Which service does the API URL port correspond to. */
  portMode: DevnetPortMode

  /** The API URL that can be used to talk to the devnet. */
  get url (): URL { return new URL(`${this.protocol}://${this.host}:${this.port}`) }

  /** This directory is created to remember the state of the devnet setup. */
  stateRoot: OpaqueDirectory

  /** List of genesis accounts that will be given an initial balance
    * when creating the devnet container for the first time. */
  genesisAccounts: Array<string> = [
    'ADMIN', 'ALICE', 'BOB', 'CHARLIE', 'MALLORY'
  ]

  /** This file contains the id of the current devnet container.
    * TODO store multiple containers */
  nodeState: JSONFile<DevnetState>

  /** Save the info needed to respawn the node */
  save (extraData = {}) {
    const data = { chainId: this.chainId, port: this.port, ...extraData }
    this.nodeState.save(data)
    return this
  }

  /** Restore this node from the info stored in the nodeState file */
  async load (): Promise<DevnetState|null> {
    const path = this.nodeState.shortPath
    if (this.stateRoot.exists() && this.nodeState.exists()) {
      //log.info(bold(`Loading:  `), path)
      try {
        const data = this.nodeState.load()
        const { chainId, port } = data
        if (this.chainId !== chainId) {
          this.log.loadingState(chainId, this.chainId)
        }
        this.port = port as number
        return data
      } catch (e) {
        this.log.loadingFailed(path)
        this.stateRoot.delete()
        throw e
      }
    } else {
      this.log.loadingRejected(path)
      return null
    }
  }

  /** Stop this node and delete its state. */
  async terminate () {
    await this.kill()
    await this.erase()
    return this
  }

  /** Retrieve an identity */
  abstract getGenesisAccount (name: string): Promise<AgentOpts>

  /** Start the node. */
  abstract spawn (): Promise<this>

  /** Start the node if stopped. */
  abstract respawn (): Promise<this>

  /** Stop the node. */
  abstract kill (): Promise<void>

  /** Erase the state of the node. */
  abstract erase (): Promise<void>

}

const log = new Console('@fadroma/devnet')

export class DevnetCommands extends CommandContext {

  constructor (public chain?: Chain) {
    super('Fadroma Devnet')
  }

  status = this.command('status', 'print the status of the current devnet', () => {
    log.chainStatus(this)
    return this
  })

  reset = this.command('reset', 'erase the current devnet', () => {
    if (this.chain) return resetDevnet({ chain: this.chain })
  })

}

export async function resetDevnet ({ chain }: { chain?: Chain } = {}) {
  if (!chain) {
    log.info('No active chain.')
  } else if (!chain.isDevnet || !chain.node) {
    log.error('This command is only valid for devnets.')
  } else {
    await chain.node.terminate()
  }
}
