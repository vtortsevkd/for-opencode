import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { proposeContract, readContract, approveContract, rejectContract, isContractApproved, negotiateContract } from '../lib/pipeline/contract.js'

test('proposeContract creates a proposed contract', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-contract-'))
  try {
    await proposeContract(dir, { id: 'c1', goal: 'g', verification: ['v1'] })
    const c = await readContract(dir)
    assert.equal(c.status, 'proposed')
    assert.equal(c.rounds, 1)
    assert.deepEqual(c.verification, ['v1'])
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('approve and reject transition status and rounds', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-contract-'))
  try {
    await proposeContract(dir, { id: 'c1', goal: 'g' })
    await rejectContract(dir, 'needs more detail')
    assert.equal((await readContract(dir)).status, 'rejected')
    await proposeContract(dir, { id: 'c1', goal: 'g2' })
    assert.equal((await readContract(dir)).rounds, 2)
    await approveContract(dir, 'evaluator')
    assert.equal(await isContractApproved(dir), true)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('negotiateContract converges when the reviewer approves', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-contract-'))
  try {
    const r = await negotiateContract(dir, {
      propose: async () => ({ id: 'c1', goal: 'g', verification: ['v'] }),
      review: async () => ({ approved: true, by: 'eval' }),
    })
    assert.equal(r.approved, true)
    assert.equal(r.rounds, 1)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('negotiateContract returns approved:false when never approved', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fis-contract-'))
  try {
    const r = await negotiateContract(dir, {
      propose: async () => ({ id: 'c1', goal: 'g', verification: ['v'] }),
      review: async () => ({ approved: false, reason: 'no' }),
      maxRounds: 2,
    })
    assert.equal(r.approved, false)
    assert.equal(r.rounds, 2)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
