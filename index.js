import { Console } from '@hackbg/konzola'
const console = Console('@hackbg/toolbox')
export * from '@hackbg/konzola'
export * from '@hackbg/kabinet'
export * from '@hackbg/dokeres'
export * from './reexports'
export * from './run'
export * from './tables'

/** Get a random free port number by briefly running a server on a random unused port,
  * then stopping the server and returning the port number. */
import { createServer } from 'net'
export function freePort () {
  return new Promise((ok, fail)=>{
    let port = 0
    const server = createServer()
    server.on('listening', () => {
      port = server.address().port
      server.close()
    })
    server.on('close', () => ok(port))
    server.on('error', fail)
    server.listen(0, '127.0.0.1')
  })
}

export const mkdir = (...fragments) => {
  const path = resolve(...fragments)
  if (!existsSync(path)) console.info('Creating directory:', path)
  mkdirp.sync(path, {mode: 0o770})
  return path
}

import _rimraf from 'rimraf'
export const rimraf = (path = "") =>
  new Promise((resolve, reject)=>{
    _rimraf(path, (err) => {
      if (err) { reject(err) } else { resolve() }
    }) })

// misc data functions /////////////////////////////////////////////////////////////////////////////

import { randomBytes } from 'crypto'

export { randomBytes }

export const randomHex = (bytes = 1) =>
  randomBytes(bytes).toString("hex")

export const randomBase64 = (bytes = 1) =>
  randomBytes(bytes).toString("base64")

import { TextDecoder } from 'util'
const decoder = new TextDecoder();
export const decode = (buffer) => decoder.decode(buffer).trim()

import { URL } from 'url'
export const loadJSON = (path = '', base = null) =>
  JSON.parse(String(
    base ? readFileSync(new URL(path, base))
         : readFileSync(path)))

export const timestamp = (d = new Date()) =>
  d.toISOString()
    .replace(/[-:\.Z]/g, '')
    .replace(/[T]/g, '_')
    .slice(0, -3)

export function pick (
  obj = {},
  ...keys
) {
  return Object.keys(obj)
    .filter(key=>keys.indexOf(key)>-1)
    .reduce((obj2,key)=>{
      obj2[key] = obj[key]
      return obj2 }, {})
}

export function required (label) {
  return () => { throw new Error(`required: ${label}`) }
}
