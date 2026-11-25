# fis-pipeline-hardening

Библиотека укрепления FIS-агентного пайплайна (JavaScript / Node, ESM, zero-dependency).
Достраивается **вокруг** существующего конвейера (этапы-субагенты → артефакты → гейты → атаки → судьи), не переписывая его.

## Что внутри

```
fis-pipeline-hardening/
├── lib/pipeline/
│   ├── index.js            # единый barrel-export
│   ├── config.js           # пути + пороги + confidence/guard/observations
│   ├── metrics.js          # 1 — pass@1/pass@3/стоимость (NDJSON + агрегация)
│   ├── judges/             # 2 — гибридные судьи (code/rule/llm + маршрутизация)
│   ├── memory/instincts.js # 3 — память + confidence-scoring + промоушн
│   ├── ledger.js           # 5 — append-only журнал + хэш-цепочка
│   ├── acceptance.js       # acceptance-чеклист (JSON, только flip false→true)
│   ├── recovery.js         # 6 — диагноз → точечная починка → эскалация
│   ├── observations.js     # конверт ответа tool + ограничение вывода
│   ├── guard.js            # fail-closed граница опасных операций
│   └── audit.js            # 12-слойный аудит-чеклист
├── skills/                 # FIS-скилы (доменное знание)
│   ├── fis-platform/       # общий домен: tools, safe/dangerous, нейминг
│   ├── fis-crud/           # жизненный цикл объектов
│   ├── fis-search-testing/ # проверка поисковых функций
│   ├── fis-ui-testing/     # UI-сценарии
│   ├── fis-security/       # fail-closed границы
│   └── fis-acceptance/     # acceptance-леджер + ритуал getting-up-to-speed
├── docs/
│   ├── INTEGRATION.md      # пошаговое внедрение
│   └── ROADMAP.md          # что сделано и что улучшать дальше
└── test/                   # 42 теста (node:test)
```

## Быстрый старт

```bash
cd fis-pipeline-hardening
npm test          # 42 теста, все зелёные
```

Импорт:

```js
import {
  record, aggregateReport, formatReport,          // метрики
  grade, registry, codeGraders, ruleGraders,      // судьи
  addInstinct, inject, reflect, observe, correct, promote, // память
  appendDecision, decisionsFor, verifyChain,      // журнал
  diagnoseFailure, recover, logRecovery, stallDetector,   // recovery
  wrapToolResponse, toolError, truncateJson,      // наблюдения
  requireSafeId, runGuarded,                      // граница
  initAcceptance, loadAcceptance, flipToPassing, pending, isComplete, progress, // acceptance
  LAYERS, DIAGNOSTIC_QUESTIONS, renderFindings,   // аудит
} from './lib/pipeline/index.js'
```

## Модули

| Модуль | Что делает | Зачем |
|--------|-----------|-------|
| **metrics** | NDJSON-эмиссия событий прогона + `pass@1`/`pass@3`/среднее время | сделать конвейер измеримым |
| **judges** | Детерминированные (code/rule) судьи, LLM — только крайняя мера | убрать флак LLM-судьи |
| **memory** | Извлечение ≤1 правила за задачу, дедупликация, confidence 0.1–0.9, промоушн | пайплайн умнеет с каждым прогоном |
| **ledger** | Append-only журнал решений + хэш-цепочка (подмена истории обнаруживается) | судьи видят «почему», история защищена |
| **acceptance** | Acceptance-чеклист в JSON: только flip `false→true`, список неизменяем | нет «победы раньше времени» |
| **recovery** | Диагноз причины → точечная починка → эскалация вместо бесконечного ретрая | доводить до конца, не зацикливаясь |
| **observations** | Конверт ответа tool (`status/summary/next_actions/artifacts/recovery_hint`) + лимит вывода | агент перестаёт парсить сырой JSON |
| **guard** | Fail-closed: authorize → confirm → execute для delete/publish/mass_update | защита платформы от необратимой ошибки |
| **audit** | 12-слойный чеклист + 7 диагностических вопросов | найти скрытые сбои в существующем пайплайне |

## Ключевые решения

- **Append-only журнал** — не конвенция, а проверяемый факт: каждая запись хранит `prev_hash = sha256(предыдущей сырой строки)`.
- **Судьи без подключённых tools честно возвращают `review`** — не выдумывают pass/fail.
- **Fail-closed** — если `authorize`/`confirm` отсутствуют или запрещают, side effect не выполняется.
- **Confidence-scoring** — инстинкт не бинарный: растёт от `observe()`, падает от `correct()`, созревает для промоушна.
- **Zero-dependency** — только `node:fs/promises`, `node:crypto`, `node:path`, `node:test`.

## Куда смотреть дальше

- **Внедрение** — `docs/INTEGRATION.md`.
- **Что улучшать** — `docs/ROADMAP.md` (аудит → compliance-тест → hooks-обучение → промоушн → observability).
- **FIS-домен** — `skills/fis-*` (подключи в `agent.md`).

## Конфигурация (env)

| Переменная | По умолчанию | Назначение |
|-----------|--------------|------------|
| `FIS_PROJECT_ROOT` | `process.cwd()` | корень проекта |
| `FIS_METRICS_DIR` | `<root>/metrics` | каталог NDJSON-логов |
| `FIS_MEMORY_FILE` | `<root>/memory/instincts.json` | файл инстинктов |
| `FIS_MAX_ATTEMPTS_PER_STAGE` | `3` | максимум повторов на этапе |
| `FIS_STALL_THRESHOLD` | `3` | одинаковых fail подряд → эскалация |
