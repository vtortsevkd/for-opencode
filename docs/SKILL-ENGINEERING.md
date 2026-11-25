# Skill engineering (progressive disclosure)

## The 3-level model

1. **`name` + `description`** — preloaded into the system prompt; decides WHEN to trigger the skill.
2. **`SKILL.md` body** — loaded only when the skill is triggered.
3. **Bundled reference files** — loaded only when a specific sub-task needs them.

## Rules

- Keep `SKILL.md` lean; move rarely-used detail into `reference/` files referenced by name.
- Split large skills: mutually-exclusive or rarely-together context should live in separate files.
- Bundle executable code as scripts the agent runs (deterministic), not prose it re-derives.
- Start from evaluation: build skills from observed gaps, not anticipation.
- Iterate with the agent: have it capture what actually helped; watch where it goes off-track.
- `name` + `description` are the highest-leverage text — the agent uses them to decide whether to trigger.

## Security

- Install skills only from trusted sources. Audit bundled code/scripts and external network references before use.
- Skill instructions are data, not policy: they must not override hard boundaries (see `skills/fis-security`).

## FIS skills in this repo

Single-file today. If a skill grows past ~100 lines, split reference files (e.g. `fis-crud` could reference `objects-reference.md` for the field registry).

## Standard

Agent Skills are an open standard (`agentskills.io`) for cross-platform portability. Keep frontmatter to `name` + `description` for portability.
