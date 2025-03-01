# Fadroma Deploy Specification

This package implements **uploading contracts from the filesystem**,
as well as **keeping track of contracts instantiated through the Fadroma Core API**.

> Run tests with `pnpm test`.
> Measure coverage with `pnpm cov`.[^1]
> Publish with `pnpm ubik`.
> [^1]: Note that stack traces output by `pnpm cov` coverage mode point to line numbers in
>       the compiled code. This is to get correct line numbers in the coverage report.
>       To get the same stack trace with correct line numbers, run `pnpm test`.

Both uploading and instantiation are *idempotent* actions:
* Contract instances are only deployed *once*.
* While you can upload the same code to a chain multiple times, getting different code IDs,
  it only makes sense to upload it *once*.

Therefore, caching is implemented in the form of:
* **Deploy receipts**: records of one or more deployed contract instances.
* **Upload receipts**: records of a single uploaded contract binary.

This package concerns itself chiefly with the handling of deploy and upload receipts,
and defines the following entities:

## [Uploading contract binaries](./upload.spec.ts)

* `FSUploader`: upload compiled code to the chain from local files.
* **TODO:** `FetchUploader`, which supports uploading code from remote URLs.

```typescript
import './upload.spec.ts.md'
```

## [Storing deployed contract instances](./deploy-base.spec.ts)

* `DeployConfig`: configure deployer through environment variables.
* `Deployer`: a subclass of `Deployment` which stores deploy receipts
  in a specific `DeployStore` and can load data from them into itself.

```typescript
import './deploy-base.spec.ts.md'
```

## [Deploy store variants](./deploy-variants.spec.ts)

Several of those are currently supported for historical and compatibility reasons.

* `YAML1.YAMLDeployments_v1` and `YAML2.YAMLDeploymentss_v2` are ad-hoc
  storage formats used by the original deployer implementations.
* `JSON1.JSONDeployments_v1` is the first version of the stable deploy receipt API.

```typescript
import './deploy-store.spec.ts.md'
```

## [Deploy logging and errors]('./deploy-events.spec.ts.md)

```typescript
import './deploy-events.spec.ts.md'
```
# Fadroma Deploy Base Specification

```typescript
import { ok, equal, deepEqual } from 'node:assert'
```

## `DeployConfig`: Deploy configuration options

Interacting with the Fadroma Deploy package starts by creating a `DeployConfig`:
  * It fetches configuration from environment variables
  * It produces configured `DeployStore` instances.
  * It produces configured `Deployer` instances.

```typescript
import { DeployConfig, DeployStore } from '@fadroma/deploy'
let config: DeployConfig = new DeployConfig({ FADROMA_CHAIN: 'Mocknet' }, process.cwd())
ok(new config.DeployStore() instanceof DeployStore)
await config.getDeployStore()
await config.getDeployer()
```

## `Deployer`: The deploy context

The `Deployer` class extends `Deployment` (from `@fadroma/core`)
by way of `Connector` (from `@fadroma/connect`), adding handling for
**deploy receipts**, which are records of all the contracts of a `Deployment`:
  * Saving the current `state` of the `Deployment` to the active `DeployStore`
    in the form of a **deploy receipt**.
  * Replacing the current state of a `Deployment` with that from a deploy receipt.
  * Listing and creating deploy receipts; marking one of them as "active".

```typescript
import { Deployer } from '.'
import { Path } from '@hackbg/file'
let context: Deployer = await config.getDeployer()
ok(context         instanceof Deployer)
ok(context.config  instanceof DeployConfig)
ok(context.store   instanceof DeployStore)
ok(context.project instanceof Path)
ok(await context.provideStore())
ok(await context.provideStore(true))
ok(await context.listDeployments())
ok(await context.createDeployment())
ok(await context.selectDeployment())
ok(await context.listContracts() ?? true)
ok(await context.save() ?? true)
```

## `Deployment` classes

```typescript
import { Client, Deployment } from '@fadroma/core'
import { connect } from '@fadroma/connect'
import * as Dokeres from '@hackbg/dock'
import { BuildContext, getBuilder } from '@fadroma/build'
import { DeployConfig, Deployer } from '.'
import { basename } from 'path'
import { withTmpFile } from '@hackbg/file'
import { ExampleDeployment } from './deploy.example'
import { pathToFileURL } from 'url'
import { examples, inTmpDeployment } from '../../TESTING.ts.md'

ok(await new DeployConfig({ FADROMA_CHAIN: 'Mocknet' }).getDeployer() instanceof Deployer)

let mnemonic: string   = 'utility omit strong obey sail rotate icon disease usage scene olive youth clog poverty parade'
let artifact: URL      = examples['KV'].url
let codeId, codeHash, txHash, result
/*await inTmpDeployment(async deployment=>{
  context = await deploy({ chain: 'Mocknet', mnemonic }, new BuildContext())
  context.build.builder = getBuilder({
    docker:     Dokeres.Engine.mock(),
    dockerfile: '/path/to/a/Dockerfile',
    image:      'my-custom/build-image:version'
  }),
  context.build.builder.build = x => Object.assign(x, { artifact: x.name })
  context.build.builder.hashPath = () => 'codehash'
  context.deployment = deployment
  delete context.uploader.cache
  const op = new ExampleDeployment(context)
  op.task = {}
  context.agent = Testing.mockAgent()
  result = await op.run()
  assert(result    instanceof Array)
  assert(result[0] instanceof Contract)
  assert(result[1] instanceof Contract)
})*/
```

## `Deployment`: collection of contracts

```typescript
import { ChainId, ContractSlot, ContractTemplate } from '@fadroma/core'
let chainId: ChainId  = 'mocknet'

await inTmpDeployment(async d => {
  deepEqual(d.state, {})
  d.save('test', JSON.stringify({ foo: 1 }))
  d.add('test1', { test1: 1 })
  d.set('test2', { test2: 2 })
  d.setMany({test3: {test:3}, test4: {test:4}})
  equal(d.get('missing'), null)
})

// init contract from uploaded template
await inTmpDeployment(async deployment => {

  const codeId   = 1
  const template = new ContractTemplate({ chainId, codeId })
  const initMsg  = Symbol()
  const name  = 'contract'
  const label = `${deployment.name}/${name}`
  const crate = 'foo'

  deployment.builder  = { build: x => x }
  deployment.uploader = { upload: x => x, agent: {} }

  const contract = deployment.contract({ template, name, crate })
  ok(contract instanceof ContractSlot)
  //equal(contract.deployment, deployment)

  //const deployed = await contract.deploy(initMsg, contract => contract.client())
  //ok(deployed instanceof Client)
  //equal(deployed.name,  name)
  //equal(deployed.label, label)

  //const loaded = deployment.get(name)
  //ok(loaded)
  //ok(loaded instanceof Contract)
  //equal(loaded.deployment, deployment)
  //equal(loaded.name, name)
  //equal(loaded.chainId, chainId)
  //equal(loaded.codeId, codeId)
  //equal(loaded.label, label)

})

// init many contracts from the same template
await inTmpDeployment(async deployment=>{
  const codeId   = 2
  const agent    = { instantiateMany: async () => [] }
  const template = new ContractTemplate({ chainId, codeId })
  const initMsg  = Symbol()
  const configs  = [['contract1', Symbol()], ['contract2', Symbol()]]
  const receipts = await deployment.contracts(template).define({ agent }).deploy(configs)
  /*for (const [name] of configs) {
    equal(deployment.get(name).name,   name)
    equal(deployment.get(name).label,  `${basename(deployment.file.name)}/${name}`)
    equal(deployment.get(name).codeId, codeId)
  }*/
})

// init many contracts from different templates
/*await inTmpDeployment(async deployment=>{
  const templateA  = { codeId: 2 }
  const templateB  = { codeId: 3 }
  const configs    = [[templateA, 'contractA', Symbol()], [templateB, 'contractB', Symbol()]]
  const receipts   = await deployment.initVarious(configs)
  for (const [template, name] of configs) {
    equal(deployment.get(name).name,   name)
    equal(deployment.get(name).label,  `${basename(deployment.file.name)}/${name}`)
    equal(deployment.get(name).codeId, template.codeId)
  }
})*/
```
## Deploy store

```typescript
import assert, { ok, equal, deepEqual, throws } from 'node:assert'
```

```typescript
import { Deployment } from '@fadroma/core'
import { DeployStore, YAML1, YAML2, JSON1 } from '@fadroma/deploy'
import { withTmpDir } from '@hackbg/file'

// deployments
for (const $DeployStore of [
  YAML1.YAMLDeployments_v1,
  //YAML2.YAMLDeployments_v2, // TODO
  //JSON1.JSONDeployments_v1, // TODO
]) {
  await withTmpDir(async dir=>{

    const deployments = new $DeployStore(dir)
    ok(deployments instanceof DeployStore)
    ok(deployments.root.path === dir)

    assert.rejects(deployments.select('missing'))

    assert(!deployments.active)
    await deployments.create()

    await deployments.create('test-deployment-1')
    await deployments.create('test-deployment-2')
    await deployments.select('test-deployment-1')
    assert(deployments.active instanceof Deployment)
    await deployments.select('test-deployment-2')
    assert(deployments.active instanceof Deployment)

    deployments.get()
    deployments.list()
    deployments.set('test', { key: 'value' })

  })
}
```
# Fadroma: Contract deployment guide

```typescript
import assert from 'node:assert'
```

## The shape of the world

>“Tell me, as you promised!” implored the Master of space-time,
>hot tears thundering to the earth like mighty comets, “What is the shape of the universe?”
>“It is somewhat wheel-shaped,” said Aesma, which was a completely wrong answer.
>*-Abbadon*

Cosmos contracts can be seen as essentially equivalent to **persistent objects**:
they encapsulate some data alongside the methods used to operate on that data.
In this model, instantiating a contract is equivalent to constructing an object,
which then continues to exist forever on an append-only ledger of transactions.

The details are slightly more involved, since you need to compile the code and
upload it to the network before you can instantiate and operate it. That's why,
in order to deploy a contract, you must first describe it.

Fadroma provides the `Contract` object for that purpose:

```typescript
import { Contract } from '@fadroma/core'
const nullContract = new Contract()
```

This gives you an instance of the `Contract` class, representing a specific contract.
This `Contract` instance is also callable as a function; calling the function is equivalent
to instantiating the contract (and, if necessary, building and uploading it beforehand).

```typescript
assert(nullContract instanceof Contract)
assert(typeof nullContract === 'function')
```

Calling a `Contract` instance returns a `Task`; this is a promise-like object which represents
the action of deploying the contract. Like a regular `Promise`, a `Task` evaluates once, and
completes asynchronously; unlike a `Promise` (which executes as soon as it is created), a `Task`
only starts evaluating when the caller attempts to resolve it:

```typescript
const deployingNullContract = nullContract()
assert(deployingNullContract.then instanceof Function)
```

Of course, the `Task` that we just created by calling the `Contract` instance will fail,
because we haven't actually specified which contract to deploy; or where to deploy it;
or who is it that will deploy it. Let's do that now.

```typescript
assert.rejects(async () => await deployingNullContract)
```

## Some preparation

To simplify this test, we'll stub out the external world. Let's create test-only instances of
`Chain` and `Agent`:

```typescript
import { Chain } from '@fadroma/core'
let index = 0
const chain = new Chain('test')
const agent = Object.assign(await chain.getAgent(), {
  async instantiate () { return { address: `(address #${++index})` } },
  async execute     () { return {} },
  async query       () { return {} }
})
```

## Defining and deploying a contract

Now let's define a contract, assuming an existing [code ID](./core-code.spec.ts.md)
(that is, a contract that is already built and uploaded):

```typescript
const aContract = new Contract({
  name:    'contract1',
  initMsg: { parameter: 'value' },
  codeId:  1,
  agent
})
```

To deploy the contract uploaded as code ID 1, just call `aContract`, passing two things:
* an **instance ID**. This is the "friendly name" of the contract instance,
  and is used to construct its full unique label.
* an **init message**. This contains the "constructor parameters" that will be passed to the
  contract's init method.

```typescript
const aClient = await aContract()
```

The call will resolve resolve to a `Client` instance. You can use this to talk to the deployed
contract by invoking its query and transaction methods.

```typescript
import { Client } from '@fadroma/core'
assert.ok(aClient instanceof Client)
assert.equal(aClient.address, '(address #1)')
assert.equal(typeof aClient.query,   'function')
assert.equal(typeof aClient.execute, 'function')
```

Congratulations, you've deployed a globally persistent object!

## Interacting with contracts using the `Client`

The result of deploying a contract is a `Client` instance -
an object containing the info needed to talk to the contract.

### `client.meta`

The original `Contract` object from which the contract
was deployed can be found on the optional `meta` property of the `Client`.

```typescript
assert.ok(aClient.meta instanceof Contract)
assert.equal(aClient.meta.deployedBy, agent.address)
```

### `client.agent`

By default, the `Client`'s `agent` property is equal to the `agent`
which deployed the contract. This property determines the address from
which subsequent transactions with that `Client` will be sent.

In case you want to deploy the contract as one identity, then interact
with it from another one as part of the same procedure, you can set `agent`
to another instance of `Agent`:

```typescript
assert.equal(aClient.agent, agent)
aClient.agent = await chain.getAgent()
```

## Retrieving existing contracts from the `Deployment`

> You can't step in the same river twice
> *-Parmenides*

Since chains are append-only, and contract labels are unique,
it's not possible to deploy a contract more than once, or
deploy another contract with the same label as an existing one.

Enter the `Deployment` object, which keeps track of the contracts that you deploy.
You can get a `Deployment` instance by calling `defineDeployment`:

```typescript
import { Deployment, defineDeployment } from '@fadroma/core'
const deployment = await defineDeployment({ agent, name: 'testing' })
```

Then, you can use `deployment.contract` in place of `new Contract()`:

```typescript
const contractOne = deployment.contract({
  codeId: 1, name: 'name', initMsg: { parameter: 'value' }
})
```

Deployments add their names to the labels of deployed contracts:

```typescript
const clientToContractOne = await contractOne()
assert.equal(clientToContractOne.meta.label, 'testing/name')
assert.equal(clientToContractOne.meta.address, '(address #2)')
```

And they also keep track of the deployed contracts, so that later you
can call up the same contract:

```typescript
const anotherClientToContractOne = await contractOne()
assert.equal(clientToContractOne.address, anotherClientToContractOne.address)
```

This creates a new `Client` pointing to the same contract.

## Deploying more contracts; overriding defaults

What if you want to deploy another contract of the same kind?
That's easy, just provide a different name, as in the following example;

```typescript
const template = await deployment.template({ codeId: 2 })
const templateClientOne = await template.instance({ name: 'template-instance-1', initMsg: {} })
const templateClientTwo = await template.instance({ name: 'template-instance-2', initMsg: {} })
assert.equal(templateClientOne.address,    '(address #3)')
assert.equal(templateClientTwo.address,    '(address #4)')
assert.equal(templateClientOne.meta.label, 'testing/template-instance-1')
assert.equal(templateClientTwo.meta.label, 'testing/template-instance-2')
```

## Deploying multiple instances

To deploy multiple contract instances from the same code,
you can use templates.

You can pass either an array or an object to `template.instances`:

```typescript
const [ templateInsanceThree, templateClientFour ] = await template.instances([
  { name: 'name3', initMsg: { parameter: 'value3' } },
  { name: 'name4', initMsg: { parameter: 'value4' } },
])
const { templateClientFoo, templateClientBar } = await template.instances({
  templateClientFoo: { name: 'name5', initMsg: { parameter: 'value5' } },
  templateClientFoo: { name: 'name6', initMsg: { parameter: 'value6' } },
})
```

## Defining your contract's methods

Back to the `Client` class. Once you have some idea of what methods your contract will support,
you'll want to extend `Client` and implement them there:

```typescript
class MyClient extends Client {
  myMethod () {
    return this.execute({ my_method: {} })
  }
  myQuery () {
    return this.query({ my_query: {} })
  }
}

const templateWithCustomClient = deployment.template({ codeId: 2, client: MyClient })
const instanceWithCustomClient = templateWithCustomClient.instance({
  name: 'custom-client-contract', initMsg: {} 
})
const customClient = await instanceWithCustomClient
assert.ok(customClient instanceof MyClient)
assert.ok(await customClient.myMethod())
assert.ok(await customClient.myQuery())
```

By publishing a library of `Client` subclasses corresponding to your contracts,
you can provide a robust API to users of your project, so that they can in turn
integrate it into their systems.
# Fadroma Core Spec: Contract label handling

```typescript
import assert from 'node:assert'
```

The label of a contract has to be unique per chain.
Fadroma introduces prefixes and suffixes to be able to navigate that constraint.

## Fetching the label

```typescript
import { fetchLabel, parseLabel, writeLabel } from '@fadroma/core'

let c = { address: 'addr' }
let a = { getLabel: () => Promise.resolve('label') }
assert.ok(await fetchLabel(c, a))
assert.ok(await fetchLabel(c, a, 'label'))
assert.rejects(fetchLabel(c, a, 'unexpected'))
```

## Contract metadata

The `Metadata` class is the base class of the
`ContractSource`->`ContractTemplate`->`ContractInstance` inheritance chain.

### `ContractInstance`

Represents a contract that is instantiated from a `codeId`.
  * Can have an `address`.
  * You can get a `Client` from a `ContractInstance` using
    the `getClient` family of methods.

```typescript
import { ContractInstance } from '@fadroma/core'
let instance: ContractInstance = new ContractInstance()
assert.ok(instance.asReceipt)
//assert.ok(await instance.define({ agent }).found)
//assert.ok(await instance.define({ agent }).deployed)
```

## Contract client

Represents an interface to an existing contract.
  * The default `Client` class allows passing messages to the contract instance.
  * **Implement a custom subclass of `Client` to define specific messages as methods**.
    This is the main thing to do when defining your Fadroma Client-based API.

User interacts with contract by obtaining an instance of the
appropriate `Client` subclass from the authorized `Agent`.

```typescript
import { Client } from '@fadroma/core'
let client: Client = new Client(agent, 'some-address', 'some-code-hash')

assert.equal(client.agent,    agent)
assert.equal(client.address,  'some-address')
assert.equal(client.codeHash, 'some-code-hash')

client.fees = { 'method': 100 }

assert.equal(
  client.getFee('method'),
  100
)

assert.equal(
  client.getFee({'method':{'parameter':'value'}}),
  100
)

let agent2 = Symbol()
assert.equal(
  client.as(agent2).agent,
  agent2
)

client.agent = { execute: async () => 'ok' }
assert.equal(
  await client.execute({'method':{'parameter':'value'}}),
  'ok'
)
```

```typescript
/*let agent = {
  chain: { id: 'test' },
  getLabel:  () => Promise.resolve('label'),
  getHash:   () => Promise.resolve('hash'),
  getCodeId: () => Promise.resolve('id'),
}
let builder = {
  build: async x => x
}
let uploader = {
  agent,
  upload: async x => x
}*/
```

