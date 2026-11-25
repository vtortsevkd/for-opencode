# Cost: prompt caching + model routing

## Prompt caching

Stable, repeated context should live in a cacheable prefix so you pay once, not per turn:

- `agent.md`, skills (`skills/fis-*`), the REST contract (OpenAPI), and constant instructions → cacheable prefix.
- Dynamic content (task text, tool results, fresh artifacts) → suffix.

Keep the prefix byte-stable across turns: reordering or editing it invalidates the cache.

## Model routing by stage

Route stages to the cheapest model that reliably passes:

| Stage / task | Model tier |
|---|---|
| Schema validation, formatting, identifier checks | cheap (haiku-class) |
| Search-function verification (deterministic grader) | cheap |
| CRUD object assembly from a registry | medium |
| Planning, open artifacts, nuanced judgment | strong (sonnet/opus-class) |

## When to measure

Track cost per successful task (`tokens_used`, `duration_ms` — already in `metrics.js`). Establish a baseline before optimizing routing: routing on guesses can hurt quality.

## Related

- `metrics.js` — where `tokens_used` is recorded.
- `config.js` — where thresholds live; add routing rules here when you implement them.
