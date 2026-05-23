# D002 — Implementer Report

**Date:** 2026-05-23T22:53:00Z
**Status:** Submitted for QA review

---

## What was built

| File | Lines | Notes |
|------|-------|-------|
| `client/vitest.config.js` | 10 | jsdom env, globals: true, include src/**/__tests__/ |
| `client/src/services/ConfigService.js` | 101 | Central config singleton |
| `client/src/services/LoggerService.js` | 119 | Level-filtered logger, sole console.* user |
| `client/src/services/StorageService.js` | 91 | localStorage wrapper, sole localStorage user |
| `client/src/services/NotifyService.js` | 117 | In-memory subscriber pattern |
| `client/src/services/__tests__/ConfigService.test.js` | 91 | 13 tests |
| `client/src/services/__tests__/LoggerService.test.js` | 97 | 13 tests |
| `client/src/services/__tests__/StorageService.test.js` | 100 | 14 tests |
| `client/src/services/__tests__/NotifyService.test.js` | 116 | 11 tests |

---

## Tests

```
 RUN  v4.1.7

 Test Files  4 passed (4)
      Tests  51 passed (51)
   Start at  22:52:06
   Duration  746ms
```

| File | Tests | Result |
|------|-------|--------|
| ConfigService.test.js | 13 | ✅ PASS |
| LoggerService.test.js | 13 | ✅ PASS |
| StorageService.test.js | 14 | ✅ PASS |
| NotifyService.test.js | 11 | ✅ PASS |
| **Total** | **51** | **✅ ALL PASS** |

- Unit tests: 51/51 PASS
- Integration tests: N/A (M1 mock only)
- Line coverage: all public methods exercised; happy path + edge cases per D002 spec

---

## R14 sanity result

**N/A for M1.**

---

## Parquet-match audit

**N/A for M1.**

---

## Performance benchmarks

D002 is a service-layer task — no hot paths.

- Vitest run duration: 746ms (51 tests, jsdom env)
- Production build: 81ms (no bundle size increase — services not imported from App yet)

---

## Grep constraint verification

### localStorage — StorageService.js ONLY ✅

```
Actual localStorage CALLS (not comments/JSDoc):
StorageService.js:30  localStorage.getItem(key)
StorageService.js:47  localStorage.setItem(key, ...)
StorageService.js:59  localStorage.removeItem(key)
StorageService.js:69  localStorage.length
StorageService.js:70  localStorage.key(i)
StorageService.js:75  localStorage.removeItem(k)
StorageService.js:86  localStorage.getItem(key)
```

ConfigService.js contains the word "localStorage" only in JSDoc comments (`@param ... localStorage key`). No `.getItem`/`.setItem` calls. ✅

### console.* — LoggerService.js ONLY ✅

```
Actual console.* CALLS (not comments/JSDoc):
LoggerService.js:68  console.info(...)
LoggerService.js:83  console.warn(...)
LoggerService.js:98  console.error(...)
LoggerService.js:113 console.debug(...)
```

All other files: zero `console.` calls in production code. ✅

---

## Architecture

### Module boundaries

- **ConfigService** — pure configuration; no imports from other services
- **LoggerService** — no imports from other services (foundational, imported by all)
- **StorageService** — imports LoggerService (to log parse errors; no silent swallow)
- **NotifyService** — imports LoggerService (to log each notification emitted)

Dependency order: `Config` (none) → `Logger` (none) → `Storage` → `Logger`; `Notify` → `Logger`

### Public API

**ConfigService** (singleton `import config from './ConfigService.js'`):
- `getApiMode()` → `'mock'`
- `getStorageKeys()` → `{ users, exams, submissions, currentUser }`
- `getDefaultExamStatus()` → `'Draft'`
- `getExamStatusOptions()` → `['Draft','Published','Closed']`
- `getRoles()` → `['teacher','student']`
- `getQuestionTypes()` → `['multiple-choice','open-text']`

**LoggerService** (singleton `import logger from './LoggerService.js'`):
- `info(msg, ...args)`
- `warn(msg, ...args)`
- `error(msg, ...args)`
- `debug(msg, ...args)`
- `setLevel('debug'|'info'|'warn'|'error')`
- `getLevel()` → current level name

**StorageService** (singleton `import storage from './StorageService.js'`):
- `get(key)` → parsed value or `null`
- `set(key, value)` — JSON.stringify + setItem
- `remove(key)`
- `clear()` — removes only `ems_*` keys
- `has(key)` → `boolean`

**NotifyService** (singleton `import notify from './NotifyService.js'`):
- `success(message)`
- `error(message)`
- `warning(message)`
- `subscribe(listener)` → `unsubscribeFn`
- `listenerCount()` → `number`

### Singleton pattern

All four services are exported as `export default new ClassName()`. One instance shared across the app. This is the consistent pattern applied to all D002+ services (D003 will follow the same convention).

---

## Edge cases tested

**ConfigService:**
- Return types verified (string, array, object)
- Array lengths exact
- Object shape exact (all four keys)
- Default status is a member of status options

**LoggerService:**
- Level filter drops messages below threshold
- debug suppressed at default `info` level
- error emitted at `error` level
- setLevel throws on unknown level string

**StorageService:**
- Round-trip for string, object, array, explicit null
- Missing key returns null (not undefined, not throws)
- Malformed JSON returns null and does not throw
- remove deletes the key; has() reflects removal
- clear() removes ems_ keys; preserves non-ems_ keys; safe on empty store

**NotifyService:**
- All three types carry correct `type` field
- Notification shape includes all four fields (type, message, id, timestamp)
- Unique ids across consecutive emits
- Timestamp within test execution window
- Unsubscribe stops delivery; calling unsub twice is safe
- Multiple subscribers all receive the same broadcast

---

## Code complexity

- Lines of code: 438 production (4 services), 404 test (4 test files)
- Cyclomatic complexity (worst function): 4 (`clear()` — loop + conditional)
- Number of TODO/FIXME: 0

---

## Self-review checklist

- [x] All 51 tests pass
- [x] R14 sanity — N/A for M1
- [x] `npm run build` passes (81ms, 0 errors)
- [x] No hardcoded secrets
- [x] No magic numbers/strings outside ConfigService (storage keys, status options, roles, question types all from ConfigService)
- [x] Grep verified: `localStorage` calls only in StorageService.js
- [x] Grep verified: `console.*` calls only in LoggerService.js
- [x] JSDoc on every public method of every service
- [x] ≥6 conventional commits on `dev` (6 required + 1 work-log = 7)
- [x] Singleton export pattern consistent across all four services
- [x] No silent error swallowing — StorageService logs errors; NotifyService logs listener throws

---

## Commits produced on `dev`

| SHA | Message |
|-----|---------|
| 7fc31a0 | `chore: add vitest configuration and devDependency` |
| e468ded | `feat: add ConfigService` |
| d59bb96 | `feat: add LoggerService` |
| 170a0bd | `feat: add StorageService` |
| d2c9411 | `feat: add NotifyService` |
| 00e7eea | `test: add Vitest unit tests for services 1/2` |
| f8a6d09 | `docs: update ai-work-log with D002 entry` |

---

## Follow-up questions for Team Lead

1. **(NotifyService ID generator)** — Used `Date.now() + incrementing counter` for notification IDs. These are session-scoped and reset on page reload. Acceptable for M1 in-memory use. If persistence is needed in M2, switch to `crypto.randomUUID()`.

2. **(LoggerService level persistence)** — The level resets on page reload (singleton is in-memory). For M1 this is fine. If the lecturer wants a `debug` mode toggle that survives refresh, it can read from ConfigService/StorageService in M2.

3. **(ConfigService frozen returns)** — `getStorageKeys()`, `getExamStatusOptions()`, `getRoles()`, `getQuestionTypes()` return `Object.freeze()`d values. Callers cannot mutate them. Confirm this is acceptable (should never need to mutate config).
