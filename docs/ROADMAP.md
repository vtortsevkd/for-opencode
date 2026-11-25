# Что уже сделано и что улучшать дальше

## Уже реализовано (в этой библиотеке)

| Модуль | Файл | Статус |
|--------|------|--------|
| 1. Метрики `pass@1`/`pass@3`/стоимость | `lib/pipeline/metrics.js` | готово + тесты |
| 2. Гибридные судьи (code/rule/llm) | `lib/pipeline/judges/*` | готово + тесты |
| 3. Память + confidence-scoring | `lib/pipeline/memory/instincts.js` | готово + тесты |
| 5. Append-only журнал + хэш-цепочка | `lib/pipeline/ledger.js` | готово + тесты |
| 6. Recovery + детектор застревания | `lib/pipeline/recovery.js` | готово + тесты |
| Конверт наблюдений tool | `lib/pipeline/observations.js` | готово + тесты |
| Fail-closed граница операций | `lib/pipeline/guard.js` | готово + тесты |
| 12-слойный аудит (чеклист) | `lib/pipeline/audit.js` | готово + тесты |
| Acceptance-леджер (JSON) | `lib/pipeline/acceptance.js` | готово + тесты |
| Delivery gate | `lib/pipeline/delivery-gate.js` | готово + тесты |
| Initializer | `lib/pipeline/initializer.js` | готово + тесты |
| Impact-проверка | `lib/pipeline/guard.js` (`assessImpact`) | готово + тесты |
| Anti-Goodhart | `goodhartRisk()` + `docs/ANTI-GOODHART.md` | готово + тесты |
| Cost (caching + routing) | `docs/COST.md` | готово (doc) |
| Cross-provider + human gate | `docs/CROSS-REVIEW.md` | готово (doc) |
| Dual-review (santa-loop) | `lib/pipeline/judges/santa.js` | готово + тесты |
| Handoff | `lib/pipeline/handoff.js` | готово + тесты |
| Prune/decay/kind | `lib/pipeline/memory/instincts.js` | готово + тесты |
| UI Electron (градер + скил) | `judges/code.js` (`ui_scenario`) + `skills/fis-ui-electron-testing` | готово + тесты |
| Session (событийный лог + нарезка) | `lib/pipeline/session.js` | готово + тесты |
| Sprint contract (согласование done) | `lib/pipeline/contract.js` | готово + тесты |
| TTFT + cache-hit метрики | `lib/pipeline/metrics.js` | готово + тесты |
| FIS-скилы | `skills/fis-*` | готово |
| Внедрение | `docs/INTEGRATION.md` | готово |

## Что улучшать дальше (по приоритету)

### 1. Прогнать 12-слойный аудит по реальному коду
Библиотека даёт чеклист (`LAYERS`, `DIAGNOSTIC_QUESTIONS`, `renderFindings`), но сам прогон — по твоему пайплайну. Ответь на 7 вопросов и собери findings; `renderFindings` отсортирует по severity. Цель — найти **hidden repair loops** (сколько LLM-проходов на один этап?) и **tool discipline** (tool принудителен в коде или только в промпте?).

### 2. Compliance-тест `agent.md`
Проверь, что `agent.md` реально управляет поведением: авто-генерация сценариев на 3 уровнях строгости (supportive → neutral → competing) + замер, выполняет ли агент предписанные шаги, когда промпт их не поддерживает. Шаги с низким compliance → в хук или код-гейт.

### 3. Обучение через хуки, а не само-отчёт
Сейчас `reflect()` — это агент пишет про себя (вероятностно). Хуки `PreToolUse`/`PostToolUse` срабатывают **100%** детерминированно. Снимай наблюдения хуками, а `reflect()` оставь как агрегатор. Это поднимает качество памяти с «~50–80%» до «всегда».

### 4. Промоушн инстинктов в постоянные скилы
`promote()` уже отдаёт инстинкты с `confidence ≥ 0.7`. Дальше — периодически кластеризовать их в новые `skills/fis-*` (атомарное правило → постоянная способность). Так `skills/` растёт из реального опыта, а не из догадок.

### 5. Наблюдаемость (когда будет Grafana)
Эмитить метрики этапов (время, gate pass rate, attack caught rate, судья flake-rate) в Grafana. Дашборд «здоровье пайплайна» → видно, какой этап деградирует, и чинишь его, а не весь промпт.

### 6. Cost / latency
- **Модель-роутинг**: простые подзадачи (валидация, форматирование) → дешёвая модель; сложные (планирование, открытые артефакты) → сильная.
- **Prompt caching**: стабильный контекст (`agent.md`, скилы, контракты) держать в кэшируемом префиксе, чтобы не платить за него на каждом ходе.

### 7. Мультимодельный судья
LLM-судья одной модели склонен к консенсусу с исполнителем. Для открытых артефактов — независимый второй судья (другая модель) с той же рубрикой; оба должны пройти.

### 8. Stress-test stale assumptions (мета-принцип 2026)
Каждый компонент harness кодирует предположение «что модель не умеет». Модели улучшаются → предположения устаревают → компоненты становятся мёртвым грузом. Периодически удаляй по одному компоненту и смотри, что реально несёт нагрузку (у Anthropic «context resets» стали dead weight на Opus 4.5). См. `docs/EVALUATOR-CALIBRATION.md`.

## Принцип движения

Не добавляй новых фич, пока не прогнал аудит (п.1) и не замерил compliance (п.2). Сначала зачистка того, что уже есть, потом — наблюдаемость и промоушн.
