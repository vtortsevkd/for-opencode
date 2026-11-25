# Внедрение библиотеки в FIS-пайплайн

Пошаговая инструкция: как встроить `fis-pipeline-hardening` в существующий конвейер (этапы-субагенты → артефакты → гейты → атаки → судьи), не ломая его.

## 0. Что уже должно быть

- Пайплайн с этапами, каждый этап — субагент, артефакты в файлах.
- REST-tools для платформы FIS.
- `agent.md` с инструкциями.

## 1. Скопировать библиотеку

Скопируй `fis-pipeline-hardening/` в свой проект (например, в `lib/`). Импорт — единый барrel:

```js
import {
  // модуль 1 — метрики
  record, aggregateReport, formatReport,
  // модуль 2 — гибридные судьи
  grade, registry, codeGraders, ruleGraders,
  // модуль 3 — память + confidence
  addInstinct, inject, reflect, observe, correct, promote,
  // модуль 5 — журнал решений
  appendDecision, decisionsFor, verifyChain,
  // модуль 6 — recovery
  diagnoseFailure, recover, logRecovery, stallDetector,
  // наблюдения + граница
  wrapToolResponse, toolError, truncateJson, requireSafeId, runGuarded,
  // аудит
  LAYERS, DIAGNOSTIC_QUESTIONS, renderFindings,
} from './lib/pipeline/index.js'
```

## 2. Конфигурация (env)

```bash
export FIS_PROJECT_ROOT=/path/to/project        # корень (куда лягут metrics/, memory/)
export FIS_MAX_ATTEMPTS_PER_STAGE=3
export FIS_STALL_THRESHOLD=3
```

Остальное (`FIS_METRICS_DIR`, `FIS_MEMORY_FILE`) — опционально.

## 3. Врезка по модулям

### Модуль 1 — метрики
В точках прогона:
```js
await record({ task_family, task_id, run_id, event: 'task_start' })
await record({ task_family, task_id, run_id, event: 'stage_end', stage, outcome, attempt_number, duration_ms })
await record({ task_family, task_id, run_id, event: 'task_end', outcome: 'done' })
```
После прогонов: `formatReport(await aggregateReport({ taskFamily }))`.

### Модуль 2 — судьи
```js
registry['created_object'] = ['code:verify_read_back', 'rule:schema_valid']
const ctx = {
  tools: {
    readObject: async (entity, id) => /* REST tool */,
    runSearch:  async (query) => /* local runner */,
  },
  llmJudge: async (artifact, prompt) => /* только для llm-градеров */,
}
const { verdict, checks } = await grade('created_object', artifact, ctx)
```

### Модуль 3 — память
- Старт прогона: `const rules = await inject(taskFamily)` → в контекст агента.
- Конец задачи: `await reflect(taskDir, { task_id, task_family })`.
- Позитивное подтверждение: `await observe(signal)`. Коррекция человеком: `await correct(signal)`.
- Созревшие правила: `await promote()` → кандидаты в постоянный skill.

### Модуль 5 — журнал
```js
await appendDecision(taskDir, { id: `D-${n}`, stage, gate, decision, reason, alternatives })
// перед судьёй этапа N:
const history = await decisionsFor(taskDir)
// на закрытие задачи:
const integrity = await verifyChain(taskDir)   // { valid, records }
```

### Модуль 6 — recovery
```js
const fc = diagnoseFailure(fail)
const gate = await stallDetector(taskDir, stage, { failure_class: fc })
if (!gate.continue) return { outcome: 'escalated', reason: gate.reason }
const plan = recover(artifactPath, fc)          // только один артефакт
// ... перегенерация ...
await logRecovery(taskDir, { stage, failure_class: fc, what_failed, what_fixed, prevention })
```

### Наблюдения + граница (внутри REST-tools)
```js
// обернуть каждый ответ tool:
return wrapToolResponse({ status: 'success', summary: '...', next_actions: [...], artifacts: [...] })

// опасные операции — fail-closed:
const r = await runGuarded({
  authorize: async (input) => ({ allowed: userCan(input.operation, input.id) }),
  confirm:   async () => await humanApproval(),   // реальное подтверждение
  execute:   async (input) => platformDelete(input.id),
  input,
})

// идентификаторы:
const safeId = requireSafeId(input.id)
```

## 4. Подключить скилы

Скопируй `skills/fis-*` в каталог скилов харнесса (или сошли на них в `agent.md`). Минимальная строка в `agent.md`:

```md
# FIS-платформа
Используй навыки: fis-platform (общий домен), fis-crud (жизненный цикл объектов),
fis-search-testing (проверка поисковых функций), fis-ui-testing (UI),
fis-security (fail-closed границы).
```

## 5. Проверка

```bash
cd fis-pipeline-hardening
npm test          # 42 теста, все зелёные
```

## 6. Первый прогон и сверка

1. Прогони одну реальную задачу.
2. Проверь: `metrics/<family>/run-*.jsonl` заполнен, `<task_dir>/decisions.jsonl` заполнен, `verifyChain` — `valid: true`.
3. Сними `aggregateReport` — получи первый baseline `pass@1`.

## Частые ошибки

- Не оборачивать ответ tool в конверт → агент парсит сырой JSON и ошибается.
- Опасную операцию гонять без `runGuarded` → есть риск необратимого действия.
- `reflect()` вызывать не на всех задачах → память не накапливается.
- Путать `attempt_number` (начинается с 1) с числом повторов (повторы = attempts − 1).
