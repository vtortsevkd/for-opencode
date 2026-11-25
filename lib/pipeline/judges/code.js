// code.js — deterministic code-based graders.
// Each grader receives ({ artifact, ctx }) and MUST return { result, detail }.
// FIS-specific checks call ctx.tools.* functions that the host pipeline wires:
//   ctx.tools.readObject(entity, id) -> Promise<object|null>
//   ctx.tools.runSearch(query)        -> Promise<Array|{count}>
// If a tool is not wired, the grader returns 'review' (never a false pass/fail).
import { access } from 'node:fs/promises'

async function fileExists(p) {
  if (!p) return false
  try {
    await access(p)
    return true
  } catch {
    return false
  }
}

export const codeGraders = {
  // Generic: the artifact's backing file must exist on disk.
  async artifact_file_exists({ artifact }) {
    const ok = await fileExists(artifact?.path)
    return { result: ok ? 'pass' : 'fail', detail: ok ? 'artifact file exists' : 'artifact file missing' }
  },

  // FIS: created object must read back via REST (idempotent verify).
  async verify_read_back({ artifact, ctx }) {
    const read = ctx?.tools?.readObject
    if (typeof read !== 'function') return { result: 'review', detail: 'tools.readObject not wired' }
    const id = artifact?.id ?? artifact?.expectedId
    if (id == null) return { result: 'review', detail: 'no id to verify read-back' }
    try {
      const obj = await read(artifact.entity, id)
      if (obj == null) return { result: 'fail', detail: `object ${id} not found on read-back` }
      return { result: 'pass', detail: `object ${id} read back` }
    } catch (e) {
      return { result: 'fail', detail: `read-back error: ${e.message}` }
    }
  },

  // FIS: search result must return the expected row count.
  async expected_row_count({ artifact, ctx }) {
    const run = ctx?.tools?.runSearch
    if (typeof run !== 'function') return { result: 'review', detail: 'tools.runSearch not wired' }
    const expected = artifact?.expectedCount
    if (expected == null) return { result: 'review', detail: 'no expectedCount specified' }
    try {
      const rows = await run(artifact.query)
      const n = Array.isArray(rows) ? rows.length : rows?.count ?? -1
      if (n === expected) return { result: 'pass', detail: `returned ${n} rows as expected` }
      return { result: 'fail', detail: `expected ${expected} rows, got ${n}` }
    } catch (e) {
      return { result: 'fail', detail: `search error: ${e.message}` }
    }
  },
}
