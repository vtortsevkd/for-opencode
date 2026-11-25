import test from 'node:test'
import assert from 'node:assert/strict'
import { LAYERS, DIAGNOSTIC_QUESTIONS, auditChecklist, renderFindings } from '../lib/pipeline/audit.js'

test('checklist has 12 layers and 7 diagnostic questions', () => {
  assert.equal(LAYERS.length, 12)
  assert.equal(DIAGNOSTIC_QUESTIONS.length, 7)
  const c = auditChecklist()
  assert.equal(c.layers.length, 12)
  assert.equal(c.questions.length, 7)
})

test('renderFindings sorts critical before low', () => {
  const text = renderFindings([
    { severity: 'low', title: 'a', mechanism: 'm' },
    { severity: 'critical', title: 'b', mechanism: 'm' },
  ])
  assert.ok(text.indexOf('critical') < text.indexOf('low'))
})

test('renderFindings renders empty without throwing', () => {
  assert.equal(renderFindings(), '')
})
