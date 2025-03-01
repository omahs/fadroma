import type { Address, Message } from './core-tx'
import type { AgentOpts, AgentClass, Agent } from './core-agent'
import type { Class } from './core-fields'
import type { Client } from './core-client'
import type { CodeId, CodeHash } from './core-code'
import { ClientError as Error, ClientConsole as Console } from './core-events'

/** A chain can be in one of the following modes: */
export enum ChainMode {
  Mainnet = 'Mainnet',
  Testnet = 'Testnet',
  Devnet  = 'Devnet',
  Mocknet = 'Mocknet'
}

/** The unique ID of a chain. */
export type ChainId = string

/** A collection of functions that return Chain instances. */
export type ChainRegistry = Record<string, (config: any)=>Chain|Promise<Chain>>

/** Options for connecting to a chain. */
export interface ChainOpts {
  /** API URL to use. */
  url:  string
  /** Whether this is a mainnet/testnet/devnet/mocknet. */
  mode: ChainMode
  /** Interface to devnet, if applicable. */
  node: DevnetHandle
}

export interface DevnetHandle {
  chainId: string
  url: URL
  respawn (): Promise<unknown>
  terminate (): Promise<this>
  getGenesisAccount (name: string): Promise<AgentOpts>
}

/** A constructor for a Chain subclass. */
export interface ChainClass<C> extends Class<C, ConstructorParameters<typeof Chain>> {
  Agent: AgentClass<Agent> // static
}

/** Represents a particular chain. */
export abstract class Chain {
  /** Async functions that return Chain instances in different modes.
    * Values for `FADROMA_CHAIN` environment variable. */
  static variants: ChainRegistry = {}
  /** Shorthand for the ChainMode enum. */
  static Mode = ChainMode
  /** The default Agent subclass to use for interacting with this chain. */
  static Agent: AgentClass<Agent> // populated below

  static mainnet <C extends Chain> (id: ChainId, options: Partial<ChainOpts>): C {
    const self = this as unknown as ChainClass<C>
    return new self(id, { ...options, mode: Chain.Mode.Mainnet })
  }
  static testnet <C extends Chain> (id: ChainId, options: Partial<ChainOpts>): C {
    const self = this as unknown as ChainClass<C>
    return new self(id, { ...options, mode: Chain.Mode.Testnet })
  }
  static devnet <C extends Chain> (id: ChainId, options: Partial<ChainOpts>): C {
    const self = this as unknown as ChainClass<C>
    return new self(id, { ...options, mode: Chain.Mode.Devnet })
  }
  static mocknet <C extends Chain> (id: ChainId, options: Partial<ChainOpts>): C {
    const self = this as unknown as ChainClass<C>
    return new self(id, { ...options, mode: Chain.Mode.Mocknet })
  }

  constructor (
    readonly id: ChainId,
    options: Partial<ChainOpts> = {}
  ) {
    if (!id) throw new Error.NoChainId()
    this.id   = id
    this.mode = options.mode!
    if (options.url) {
      this.url = options.url
    }
    if (options.node) {
      if (options.mode === Chain.Mode.Devnet) {
        this.node = options.node
        if (this.url !== String(this.node.url)) {
          this.log.warnUrlOverride(this.node.url, this.url)
          this.url = String(this.node.url)
        }
        if (this.id !== this.node.chainId) {
          this.log.warnIdOverride(this.node.chainId, this.id)
          this.id = this.node.chainId
        }
      } else {
        this.log.warnNodeNonDevnet()
      }
    }
    Object.defineProperties(this, {
      'id':    { enumerable: false, writable: true },
      'url':   { enumerable: false, writable: true },
      'mode':  { enumerable: false, writable: true },
      'log':   { enumerable: false, writable: true },
      'Agent': { enumerable: false, writable: true },
    })
  }

  get [Symbol.toStringTag]() { return `${this.mode}: ${this.id} @ ${this.url}` }

  /** Defined as true on Secret Network-specific subclasses. */
  isSecretNetwork = false
  /** Logger. */
  log = new Console('Fadroma.Chain')
  /** The Agent subclass to use for interacting with this chain. */
  Agent: AgentClass<Agent> = (this.constructor as ChainClass<unknown>).Agent
  /** The API URL to use. */
  readonly url:  string = ''
  /** Whether this is mainnet, public testnet, local devnet, or mocknet. */
  readonly mode: ChainMode
  /** Whether this is a mainnet. */
  get isMainnet () { return this.mode === ChainMode.Mainnet }
  /** Whether this is a testnet. */
  get isTestnet () { return this.mode === ChainMode.Testnet }
  /** Whether this is a devnet. */
  get isDevnet  () { return this.mode === ChainMode.Devnet  }
  /** Whether this is a mocknet. */
  get isMocknet () { return this.mode === ChainMode.Mocknet }
  /** Whether this is a devnet or mocknet. */
  get devMode   () { return this.isDevnet || this.isMocknet }
  /** Return self. */
  get chain     () { return this }
  /** If this is a devnet, this contains an interface to the devnet container. */
  readonly node?: DevnetHandle
  /** Get the current block height. */
  abstract get height (): Promise<number>
  /** Wait for the block height to increment. */
  get nextBlock (): Promise<number> {
    return this.height.then(async startingHeight=>{
      this.log.waitingForNextBlock(startingHeight)
      return new Promise(async (resolve, reject)=>{
        try {
          while (true) {
            await new Promise(ok=>setTimeout(ok, 100))
            const height = await this.height
            if (height > startingHeight) return resolve(height)
          }
        } catch (e) {
          reject(e)
        }
      })
    })
  }
  /** The default denomination of the chain's native token. */
  abstract defaultDenom: string
  /** Get the native balance of an address. */
  abstract getBalance (denom: string, address: Address): Promise<string>
  /** Query a smart contract. */
  abstract query <U> (contract: Client, msg: Message): Promise<U>
  /** Get the code id of a smart contract. */
  abstract getCodeId (address: Address): Promise<CodeId>
  /** Get the label of a smart contract. */
  abstract getLabel (address: Address): Promise<string>
  /** Get the code hash of a smart contract. */
  abstract getHash (address: Address|number): Promise<CodeHash>
  /** Get the code hash of a smart contract. */
  async checkHash (address: Address, expectedCodeHash?: CodeHash) {
    // Soft code hash checking for now
    const fetchedCodeHash = await this.getHash(address)
    if (!expectedCodeHash) {
      this.log.warnNoCodeHashProvided(address, fetchedCodeHash)
    } if (expectedCodeHash !== fetchedCodeHash) {
      this.log.warnCodeHashMismatch(address, expectedCodeHash, fetchedCodeHash)
    } else {
      this.log.confirmCodeHash(address, fetchedCodeHash)
    }
    return fetchedCodeHash
  }
  /** Get a new instance of the appropriate Agent subclass. */
  async getAgent (
    options?: Partial<AgentOpts>,
    _Agent:   AgentClass<Agent> = Chain.Agent as unknown as AgentClass<Agent>
  ): Promise<Agent> {
    _Agent  ??= this.Agent as AgentClass<Agent>
    options ??= {}
    if (this.node) await this.node.respawn()
    if (!options.mnemonic && options.name) {
      if (!this.node) throw new Error.NameOutsideDevnet()
      options = { ...options, ...await this.node.getGenesisAccount(options.name) }
    }
    options!.chain = this
    const agent = new _Agent(options)
    return agent
  }
}

/** @returns the chain of a thing
  * @throws  ExpectedChain if missing. */
export function assertChain <C extends Chain> (thing: { chain?: C|null } = {}): C {
  if (!thing.chain) throw new Error.NoChain()
  return thing.chain
}
