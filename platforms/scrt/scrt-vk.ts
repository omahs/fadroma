import { Client } from '@fadroma/core'
import { randomBytes } from '@hackbg/4mat'

export type ViewingKey = string

export class ViewingKeyClient extends Client {

  async create (entropy = randomBytes(32).toString("hex")) {
    const msg = { create_viewing_key: { entropy, padding: null } }
    let { data } = await this.execute(msg) as { data: Uint8Array|Uint8Array[] }
    if (data instanceof Uint8Array) {
      return data
    } else {
      return data[0]
    }
  }

  async set (key: unknown) {
    return this.execute({ set_viewing_key: { key } })
  }

}
