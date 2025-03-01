import $, { Path, TextFile } from '@hackbg/file'
import { bold } from '@hackbg/logs'
import type { Contract } from '@fadroma/core'
import { BuildConsole } from './build-events'

import { fileURLToPath } from 'node:url'

export function getGitDir ({ workspace }: Partial<Contract<any>> = {}): DotGit {
  if (!workspace) throw new Error("No workspace specified; can't find gitDir")
  return new DotGit(workspace)
}

/** Represents the real location of the Git data directory.
  * - In standalone repos this is `.git/`
  * - If the contracts workspace repository is a submodule,
  *   `.git` will be a file containing e.g. "gitdir: ../.git/modules/something" */
export class DotGit extends Path {

  /* Matches "/.git" or "/.git/" */
  static rootRepoRE = new RegExp(`${Path.separator}.git${Path.separator}?`)

  constructor (base: string|URL, ...fragments: string[]) {

    if (base instanceof URL) base = fileURLToPath(base)

    super(base, ...fragments, '.git')

    if (!this.exists()) {
      // If .git does not exist, it is not possible to build past commits
      this.log.warn(bold(this.shortPath), 'does not exist')
      this.present = false

    } else if (this.isFile()) {
      // If .git is a file, the workspace is contained in a submodule
      const gitPointer = this.as(TextFile).load().trim()
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

  log = new BuildConsole('Fadroma.DotGit')

  readonly present:     boolean

  readonly isSubmodule: boolean = false

  get rootRepo (): Path {
    return $(this.path.split(DotGit.rootRepoRE)[0])
  }

  get submoduleDir (): string {
    return this.path.split(DotGit.rootRepoRE)[1]
  }

}

