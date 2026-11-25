---
name: fis-crud
description: Object lifecycle checklist on FIS — create with verify read-back, update immutably, delete fail-closed. Activate for any create/update/delete of FIS objects.
metadata:
  origin: FIS
---

# FIS Object CRUD

A disciplined lifecycle for FIS objects. Every step leaves evidence; no step is "done" without a check.

## Lifecycle Checklist

### 1. Create
- Validate the identifier with the safe-id rule (no spaces, no traversal, ≤64 chars).
- Build the object from the field registry (never invent fields).
- Call the create tool and capture its `summary` + `artifacts`.

### 2. Verify read-back (MANDATORY)
- After create, read the object back via the read tool and confirm it matches.
- A create without a read-back is **not complete** — treat it as an open step.
- Record the read-back as evidence (artifact id + timestamp).

### 3. Update (immutable)
- Never mutate a shared object in place. Create a new revision/copy and apply changes.
- State what changed and why; record it in the decision journal.

### 4. Delete (fail-closed)
- `delete` is irreversible. It requires authorization + explicit confirmation.
- Confirm the exact object, its scope, and downstream references before deleting.
- No confirmation → no side effect.

## Anti-Patterns

- Create without read-back (silent "orphan" objects).
- In-place mutation of shared state.
- Deleting without checking downstream references.
- Trusting a prompt-level "must verify" rule that is not enforced in code.

## Canonical Example

A complete, correct `create` + verify read-back:

1. `requireSafeId('Contractor_001')` passes.
2. `create('Contractor', { id: 'Contractor_001', name: 'ООО Ромашка' })` → envelope `status: success`.
3. `readObject('Contractor', 'Contractor_001')` returns the object; compare fields.
4. Flip the acceptance criterion `contractor_created` to `passes: true`.
5. Record the decision: `{ id: 'D-…', decision: 'created Contractor_001', reason: 'verified read-back' }`.

## Evidence

After each object operation, the decision journal should contain: operation, object id, verify-read result, and the reason for any update/delete.
