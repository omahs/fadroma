import { Env } from '@hackbg/konfizi'
import { bold } from '@hackbg/konzola'
import $ from '@hackbg/kabinet'
import { ConnectConfig, ConnectConsole, ConnectContext } from '@fadroma/connect'
import { Deployment, Uploader, override } from '@fadroma/client'
import { FSUploader } from './upload'

export class DeployConfig extends ConnectConfig {
  constructor (
    readonly env: Env = {},
    readonly cwd: string = '',
    defaults: Partial<DeployConfig> = {}
  ) {
    super(env, cwd)
    this.override(defaults)
  }
  /** Project root. Defaults to current working directory. */
  project:  string  = this.getString ('FADROMA_PROJECT',      () => this.cwd)
  /** Whether to generate unsigned transactions for manual multisig signing. */
  multisig: boolean = this.getBoolean('FADROMA_MULTISIG',     () => false)
  /** Whether to always upload contracts, ignoring upload receipts that match. */
  reupload: boolean = this.getBoolean('FADROMA_REUPLOAD',     () => false)
  /** Directory to store the receipts for the deployed contracts. */
  uploads:  string  = this.getString ('FADROMA_UPLOAD_STATE', () =>
    $(this.project).in('receipts').in(this.chainId).in('uploads').path)
  /** Directory to store the receipts for the deployed contracts. */
  deploys:  string  = this.getString ('FADROMA_DEPLOY_STATE', () =>
    $(this.project).in('receipts').in(this.chainId).in('deployments').path)
  async connect (): Promise<DeployContext> {
    const { chain, agent } = await super.connect()
    const deployments = new Deployments(this.deploys)
    const uploader    = new FSUploader(this.uploads)
    return new DeployContext({
      config: this,
      chain,
      agent,
      deployments
    })
  }
}

/** Command runner. Instantiate one in your script then use the
  * **.command(name, info, ...steps)**. Export it as default and
  * run the script with `npm exec fadroma my-script.ts` for a CLI. */
export class DeployContext extends ConnectContext {
  constructor (options: Partial<DeployContext> = {}) {
    super(options.config as ConnectConfig, options.chain, options.agent)
    override(this, options)
    if (!this.agent) this.log.warnNoDeployAgent()
  }
  /** Logger. */
  log = new DeployConsole('Fadroma Deploy')
  /** Configuration. */
  declare config:    DeployConfig
  /** Implements uploading and upload reuse. */
  uploader?:         Uploader
  /** Contains available deployments for the current chain. */
  deployments:       Deployments|null = null
  /** Currently selected deployment. */
  get deployment (): Deployment|null {
    return this.deployments?.active || null
  }
  /** Print a list of deployments on the selected chain. */
  list = this.command('deployments', `print a list of all deployments on this chain`,
    (): Deployments => {
      const deployments = this.expectEnabled()
      this.log.deploymentList(this.chain?.id??'(unspecified)', deployments)
      return deployments
    })
  /** Make a new deployment the active one. */
  select = this.command('select', `select another deployment on this chain`,
    async (id?: string): Promise<void> => {
      const deployments = this.expectEnabled()
      const list = deployments.list()
      if (list.length < 1) {
        this.log.info('\nNo deployments. Create one with `deploy new`')
      }
      if (id) {
        this.log.info(bold(`Selecting deployment:`), id)
        await deployments.select(id)
      }
      if (list.length > 0) {
        this.list()
      }
      if (deployments.active) {
        this.log.info(`Currently selected deployment:`, bold(deployments.active.name))
      } else {
        this.log.info(`No selected deployment.`)
      }
    })
  /** Create a new deployment and add it to the command context. */
  create = this.command('create', `create a new empty deployment on this chain`,
    async (name: string = this.timestamp): Promise<void> => {
      const deployments = this.expectEnabled()
      await deployments?.create(name)
      await deployments?.select(name)
    })
  /** Print the status of a deployment. */
  status = this.command('status', 'show the current deployment',
    async (id?: string): Promise<void> => {
      const deployments = this.expectEnabled()
      const deployment  = id ? deployments.get(id) : deployments.active
      if (deployment) {
        this.log.deployment({ deployment })
      } else {
        this.log.info('No selected deployment on chain:', bold(this.chain?.id??'(no chain)'))
      }
    })
  private expectEnabled = (): Deployments => {
    if (!(this.deployments instanceof Deployments)) {
      //this.log.error('context.deployments was not populated')
      //this.log.log(context)
      throw new Error('Deployments were not enabled')
    }
    return this.deployments
  }
}

export abstract class Deployments {
  /** Name of symlink marking active deployment. */
  KEY = '.active'
  /** Create a new deployment. */
  abstract create (name?: string): Promise<Deployment>
  /** Get a deployment by name, or null if such doesn't exist. */
  abstract get    (name: string):  Deployment|null
  /** Get the names of all stored deployments. */
  abstract list   ():              string[]
  /** Activate a new deployment, or throw if such doesn't exist. */
  abstract select (name: string):  Promise<Deployment>
  /** Get the active deployment, or null if there isn't one. */
  get active (): Deployment|null {
    return this.get(this.KEY)
  }
}

export class DeployConsole extends ConnectConsole {
  name = 'Fadroma Deploy'
  deployment = ({ deployment }: { deployment: Deployment }) => {
    if (deployment) {
      const { state = {}, name } = deployment
      let contracts: string|number = Object.values(state).length
      contracts = contracts === 0 ? `(empty)` : `(${contracts} contracts)`
      const len = Math.min(40, Object.keys(state).reduce((x,r)=>Math.max(x,r.length),0))
      this.info('│ Active deployment:'.padEnd(len+2), bold($(deployment.name).shortPath), contracts)
      const count = Object.values(state).length
      if (count > 0) {
        for (const name of Object.keys(state)) {
          this.receipt(name, state[name], len)
        }
      } else {
        this.info('│ This deployment is empty.')
      }
    } else {
      this.info('│ There is no selected deployment.')
    }
  }
  receipt = (name: string, receipt: any, len = 35) => {
    name = bold(name.padEnd(len))
    if (receipt.address) {
      const address = `${receipt.address}`.padStart(45)
      const codeId  = String(receipt.codeId||'n/a').padStart(6)
      this.info('│', name, address, codeId)
    } else {
      this.info('│ (non-standard receipt)'.padStart(45), 'n/a'.padEnd(6), name)
    }
  }
  warnNoDeployment = () => this.warn(
    'No active deployment. Most commands will fail. ' +
    'You can create a deployment using `fadroma-deploy new` ' +
    'or select a deployment using `fadroma-deploy select` ' +
    'among the ones listed by `fadroma-deploy list`.'
  )
  warnNoAgent = () => this.warn(
    'No agent. Authenticate by exporting FADROMA_MNEMONIC in your shell.'
  )
  warnNoDeployAgent = () => this.warn(
    'No deploy agent. Deployments will not be possible.'
  )
  deploymentList = (chainId: string, deployments: Deployments) => {
    const list = deployments.list()
    if (list.length > 0) {
      this.info(`Deployments on chain ${bold(chainId)}:`)
      let maxLength = 0
      for (let name of list) {
        if (name === deployments.KEY) continue
        maxLength = Math.max(name.length, maxLength)
      }
      for (let name of list) {
        if (name === deployments.KEY) continue
        const deployment = deployments.get(name)!
        const count = Object.keys(deployment.state).length
        let info = `${bold(name.padEnd(maxLength))}`
        if (deployments.active && deployments.active.name === name) info = `${bold(name)} (selected)`
        info = `${info} (${deployment.size} contracts)`
        this.info(` `, info)
      }
    } else {
      this.info(`No deployments on chain ${bold(chainId)}`)
    }
    this.br()
  }
}
