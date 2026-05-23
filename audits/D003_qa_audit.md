# D003 — QA Audit Report

**Date:** 2026-05-23T20:15:00Z
**Auditing:** D003 (Services 2/2: MockApiService + seed data + entity models)
**Implementer report:** audits/D003_implementer_report.md
**Verdict:** PASS

---

## R14 sanity (independent verification)

**N/A for M1** — no numeric reproduction gate per OVERLAY.

---

## Spec-literal code review

Spec sources: `docs/spec_brief.txt` §7 (Data Model) and §8 (MockApiService).

### Entity models — verified matches

#### User (`models/User.js`)

| Spec §7 requirement | Code | Result |
|---|---|---|
| Fields: id, name, email, password, role | `User.js:38–46` | ✓ |
| `role` ∈ `{teacher, student}` validation | `User.js:14` (`VALID_ROLES`) + `:33–35` | ✓ |
| Required fields throw on missing | name/email/password/role all validated `:29–32` | ✓ |
| id auto-generated when absent | `User.js:38` uses `generateId()` | ✓ |
| `toJSON()` | `User.js:54–62` — all 5 fields | ✓ |
| `static fromJSON(obj)` | `User.js:70–72` | ✓ |
| Models PURE (no service imports) | Only `import { generateId } from './util.js'` | ✓ |

#### Exam (`models/Exam.js`)

| Spec §7 requirement | Code | Result |
|---|---|---|
| Fields: id, title, description, durationMinutes, status, createdBy, questions, createdAt | `Exam.js:52–71` | ✓ |
| `status` ∈ `Config.getExamStatusOptions()` validation | `Exam.js:17` + `:48–50` | ✓ |
| `status` defaults to `'Draft'` | `Exam.js:47` (`status \|\| 'Draft'`) | ✓ |
| `durationMinutes` defaults to 60 | `Exam.js:59` | ✓ |
| `questions` stored as plain objects for clean round-trip | Documented at `:8–11`, `:65–69` | ✓ |
| Required: title, createdBy | `:44–45` | ✓ |
| `toJSON()` + `static fromJSON()` | `:81–102` | ✓ |

#### Question (`models/Question.js`)

| Spec §7 requirement | Code | Result |
|---|---|---|
| Fields: id, examId, type, text, options, correctAnswer, points | `Question.js:44–57` | ✓ |
| `type` ∈ `['multiple-choice','open-text']` | `:13` + `:35–37` | ✓ |
| `multiple-choice` requires non-empty options | `:39–42` | ✓ |
| `open-text` allows empty options | Implicit — only MC check at `:40` | ✓ |
| `points` defaults to 1 | `:57` | ✓ |
| `correctAnswer` defaults to null when undefined | `:55` | ✓ |
| `toJSON()` + `static fromJSON()` | `:65–86` | ✓ |

#### Submission (`models/Submission.js`)

| Spec §7 requirement | Code | Result |
|---|---|---|
| Fields: id, examId, studentId, answers, status, grade, feedback, submittedAt | `:52–69` | ✓ |
| Required: examId, studentId | `:43–44` | ✓ |
| `answers` as plain objects array (default `[]`) | `:61` | ✓ |
| `grade` defaults to null | `:65` | ✓ |
| `toJSON()` + `static fromJSON()` | `:77–98` | ✓ |
| Status enum `['submitted','graded']` | `:16` — see NOTE #1 (spec §7 doesn't enumerate, Implementer chose these values) | ⚠️ NOTE |

#### Answer (`models/Answer.js`)

| Spec §7 requirement | Code | Result |
|---|---|---|
| Fields: questionId, value | `Answer.js:24–27` | ✓ |
| Required: questionId | `:22` | ✓ |
| value defaults to null | `:27` | ✓ |
| Embedded (not a top-level collection) | Documented `:4` | ✓ |
| `toJSON()` + `static fromJSON()` | `:32–50` | ✓ |

#### models/util.js

- `generateId()` wraps `crypto.randomUUID()` with `Math.random` fallback for environments without full crypto. ✓
- Models only import from `util.js`, never from services — circular dependency risk eliminated. ✓

### seedData.js — verified matches

| Spec requirement | Code | Result |
|---|---|---|
| `getSeedData()` returns `{ users, exams, submissions }` | `seedData.js:33–107` | ✓ |
| One teacher user, one student user | Lines `:36–48` — `teacher@ems.dev` (teacher) + `student@ems.dev` (student) | ✓ |
| Both passwords `'password'` (M1 mock) | `:40`, `:47` | ✓ |
| At least one Published exam with ≥2 questions | Published exam `:53–81` — 2 questions (1 MC, 1 open-text) | ✓ |
| At least one Draft exam | Draft exam `:82–101` — 1 open-text question | ✓ |
| IDs hard-coded (deterministic) | `SEED_IDS` object `:15–23` | ✓ |
| `SEED_IDS` exported for tests | `:15` `export const SEED_IDS` | ✓ |
| Demo credentials in `docs/ai-work-log.txt` | Present in D003 entry (Teacher: teacher@ems.dev, Student: student@ems.dev, password: password) | ✓ |

### MockApiService — verified matches

| Spec §8 requirement | Code | Result |
|---|---|---|
| Constructor-injected: `(storage, config, logger)` | `MockApiService.js:25–33` | ✓ |
| Constructor guard — throws on missing dep | `:26–28` names each missing dep | ✓ |
| `async seedIfEmpty()` — idempotent gate on users.length > 0 | `:88–105` | ✓ |
| `async get(collection)` | `:113–115` | ✓ |
| `async getById(collection, id)` → record or null | `:124–127` | ✓ |
| `async post(collection, record)` — generates id if missing | `:138–144` | ✓ |
| `async put(collection, id, record)` — throws if id missing or not found | `:156–168` | ✓ |
| `async delete(collection, id)` — throws if not found | `:179–188` | ✓ |
| `async clear(collection)` — empties only that collection | `:198–201` | ✓ |
| All methods return Promises (async keyword) | All 7 methods use `async` | ✓ |
| Collection → storage key via `Config.getStorageKeys()` | `_key()` at `:46–54`; `this._keys = config.getStorageKeys()` at `:33` | ✓ |
| Logging via injected logger (not console) | All log calls use `this._logger.*()` | ✓ |
| Unknown collection → rejects with clear error | `_key()` throws at `:47–52` | ✓ |

**Discrepancy — MINOR:** `MockApiService.js:17` — `VALID_COLLECTIONS = ['users', 'exams', 'submissions']` is a hardcoded module-level constant, not derived from ConfigService. See MINOR finding #1.

### services/index.js — verified

- Re-exports D002 singletons (`config`, `logger`, `storage`, `notify`). ✓
- Creates `mockApi = new MockApiService(storage, config, logger)`. ✓
- Single source of wired service instances for the entire app. ✓
- Design deviation from D003 spec pseudo-code (re-exports vs `new ConfigService()`) — documented in FQ #3; see NOTE #2.

### App.jsx — verified

| Spec requirement | Code | Result |
|---|---|---|
| Import `mockApi` via `services/index.js` | `App.jsx:6` | ✓ |
| `useEffect` with empty deps calling `seedIfEmpty()` | `App.jsx:11–13` | ✓ |
| Landing message "EMS_M1 — mock data seeded" | `App.jsx:17` (shown once `ready=true`) | ✓ |
| No business logic beyond seed call | `useState` + conditional render only — no auth/data logic | ✓ |

**Discrepancy — MINOR:** `App.jsx:12` — `mockApi.seedIfEmpty().then(() => setReady(true))` has no `.catch()` handler. If `seedIfEmpty` rejects (e.g., storage quota error), the rejection is unhandled, `ready` remains `false` forever, and the UI freezes at "loading…" with no error feedback. See MINOR finding #2.

---

## Independent test execution

### My vitest run

```
 RUN  v4.1.7 /Users/dormor/Desktop/Stocks/QuantDeploy/deployments/EMS_M1/client

 Test Files  6 passed (6)
      Tests  106 passed (106)
   Start at  23:08:32
   Duration  1.15s (transform 158ms, setup 0ms, import 239ms, tests 38ms, environment 5.46s)
```

**106/106 PASS** — well above ≥22 cumulative spec requirement.

### Test count reconciliation

| File | Tests | Per Implementer table |
|---|---|---|
| ConfigService.test.js | 13 | 13 ✓ |
| LoggerService.test.js | 13 | 13 ✓ |
| StorageService.test.js | 14 | 14 ✓ |
| NotifyService.test.js | 11 | 11 ✓ |
| models.test.js | 35 | 35 ✓ |
| MockApiService.test.js | **20** | **22 ✗** |
| **Total** | **106** | 108 claimed → 106 Vitest actual |

**MINOR discrepancy in Implementer report:** The table claims 22 tests for `MockApiService.test.js`, but the file contains exactly 20 `it()` blocks (verified by line count). Vitest's output of 106 confirms the actual total. The Implementer's text narrative also says "22 MockApiService tests" — slight overcount. The 106 total is correct; only the per-file breakdown is off. This is a report-quality issue only.

### Test quality review

**models.test.js (35 tests):**
Full coverage of each model's constructor, validation, defaults, auto-generated fields, and `toJSON/fromJSON` round-trips. Edge cases:
- Missing-field throws verified with `/fieldName/i` regex matchers — correct style.
- `Exam` preserves questions array on round-trip ✓
- `Submission` preserves answers array ✓
- `User` accepts both `'teacher'` and `'student'` roles ✓
- `Question` enforces MC options non-empty ✓, allows empty for open-text ✓
- No test for `Exam` with `VALID_STATUSES.includes('Archived')` — i.e., the `'Archived'` invalid-status throw is tested ✓

**MockApiService.test.js (20 tests):**
`beforeEach` clears `localStorage` AND silences logger output — good isolation. `afterEach` restores mocks. Helper `mkApi()` creates fresh instance per test.
- All 7 public methods covered.
- Both success and error paths for `put`, `delete`.
- `seedIfEmpty` idempotency verified via sentinel record pattern.
- `clear()` cross-collection isolation verified.
- `post` + `get` round-trip for all three collections in single test.

### Untested edge cases (informational)

1. **MockApiService**: No test for `post()` with an object whose `id` field is an empty string (treated as falsy → `generateId()` called). Could produce unexpected behaviour if a caller passes `{ id: '' }`.
2. **MockApiService**: No test for `clear()` called on an already-empty collection — should not throw (calling `_write('users', [])` on an empty array is harmless but untested).
3. **Models**: No test for `Exam` constructed with `durationMinutes: 0` — currently `0` is falsy, so `typeof 0 === 'number'` check at `Exam.js:59` handles it correctly (uses `0`, not default `60`). Worth having a test to guard against regressions.
4. **seedData**: No test that `getSeedData()` is idempotent (returns a fresh object each call, not a shared reference). Could cause mutation bugs if callers modify the returned object.

---

## Grep constraint verification (independent)

### localStorage exclusivity

```
grep -rn "localStorage\." client/src/ --include="*.js" --include="*.jsx" | grep -v "__tests__" | grep -v "StorageService.js"
```

Result: **one match** — `MockApiService.js:2` — a JSDoc comment (`* MockApiService — simulates a backend REST API backed by localStorage.`). This is documentation text only, not a code call. **No actual `localStorage.*` calls outside StorageService.js in production code.** ✓

### console.* exclusivity

```
grep -rn "console\." client/src/ --include="*.js" --include="*.jsx" | grep -v "__tests__" | grep -v "LoggerService.js"
```

Result: **no matches**. ✓ All console output in production code flows through `LoggerService.js`.

`MockApiService.test.js` uses `vi.spyOn(console, 'info')` etc. — these are test-file spy setups, not direct `console.X()` calls from production code. Allowed per spec.

### Magic strings / collection names

All `localStorage` storage-key lookups flow from ConfigService:
- `MockApiService._keys = config.getStorageKeys()` (constructor, line 33)
- `_key(collection)` returns `this._keys[collection]` (line 53)
- Actual `localStorage.setItem/getItem` calls happen in `StorageService` via `storage.set/get` with these keys ✓

`VALID_COLLECTIONS = ['users', 'exams', 'submissions']` is a module-level constant (named, not inline) used for validation only. The actual key-name strings used for storage DO flow from ConfigService — see MINOR finding #1 for the residual coupling risk.

Storage key strings (`ems_users`, `ems_exams`, etc.) confirmed absent from all files except `ConfigService.js` (definition) and `StorageService.test.js` test setup (allowed). ✓

---

## Production build verification (independent)

```
$ cd client && npm run build
vite v8.0.14 building client environment for production...
✓ 24 modules transformed.
dist/assets/index-uqV_xaJ-.js   196.95 kB │ gzip: 62.41 kB
✓ built in 84ms
```

**PASS** — 24 modules (up from 16 in D001/D002 — correct, 8 new modules: 5 models + util + MockApiService + index). Bundle size 196.95 kB gzip 62.41 kB (minimal growth from D002's ~190 kB). ✓

---

## Complexity verification

No hot paths. Highest-complexity function is `seedIfEmpty()` — one branch (users.length check) = cyclomatic complexity 2. `clear()` in MockApiService is O(1) (writes empty array). `delete()` / `put()` are O(n) on collection size — acceptable for M1 mock data scale (≤1000 records). No benchmarks needed.

---

## Security audit

- **Hardcoded secrets:** None. grep of `client/src/` shows no API keys or auth secrets. ✓
- **Passwords in seedData:** `'password'` in `seedData.js` is intentional M1 mock auth per spec ("password plain-text for M1 mock auth"). Documented in ai-work-log.txt. ✓
- **No `console.log` in production code:** Confirmed. ✓
- **`.env` in `.gitignore`:** Confirmed from D001/D002 audit. ✓

---

## Architecture review

- **Module boundaries:** `models/` → `models/util.js` only (no service imports). `services/MockApiService.js` → `models/util.js` (for `generateId`) + `data/seedData.js`. `services/index.js` → all services. `app/App.jsx` → `services/index.js`. Clean layering. ✓
- **No circular imports:** models → util; services → models; app → services. DAG verified. ✓
- **All methods async:** 7 MockApiService methods all use `async`. M2 interface-swap compatibility preserved. ✓
- **Constructor injection:** MockApiService receives storage/config/logger — unit-testable with real singletons + jsdom. ✓
- **No business logic in App.jsx:** `useState` + `useEffect` seed call + conditional render only. ✓
- **No direct localStorage in App.jsx or models:** Verified. ✓

---

## Git log verification

D003 required commits (spec: ≥6 in declared order):

| # | SHA | Message | Status |
|---|---|---|---|
| 1 | `18287e1` | `feat: add User, Question, and Answer entity models` | ✅ |
| 2 | `84ee6cb` | `feat: add Exam and Submission entity models` | ✅ |
| 3 | `6f6fd7a` | `feat: add seed data with demo teacher and student accounts` | ✅ |
| 4 | `08e8ff8` | `feat: add MockApiService with seedIfEmpty and CRUD` | ✅ |
| 5 | `6edf737` | `chore: wire service singletons in services/index.js and call seedIfEmpty on boot` | ✅ |
| 6 | `bbacaea` | `test: add Vitest tests for models and MockApiService` | ✅ |
| 7 | `b8faed2` | `docs: update ai-work-log with D003 entry and demo credentials` | bonus ✅ |

**7 commits on `dev`** (≥6 required). All conventional-commit format. Correct ordering confirmed. ✓

**`origin/dev` sync:** `git log --oneline origin/dev` confirms all 7 D003 commits pushed. ✓

---

## Acceptance criteria checklist (D003.md)

| Criterion | Status | Evidence |
|---|---|---|
| 5 model files under `client/src/models/` | ✅ PASS | User.js, Exam.js, Question.js, Submission.js, Answer.js + bonus util.js |
| `seedData.js` exists, deterministic | ✅ PASS | Hard-coded UUIDs; `getSeedData()` pure function |
| MockApiService with all 7 methods | ✅ PASS | seedIfEmpty, get, getById, post, put, delete, clear |
| `services/index.js` wires singletons | ✅ PASS | Re-exports D002 + creates mockApi |
| Client shows "mock data seeded" + no re-seed on refresh | ✅ PASS | App.jsx `useEffect` + `seedIfEmpty()` idempotency gate verified in test |
| `npx vitest run` passes; total ≥22 tests | ✅ PASS | Independently ran: 106/106 ✓ |
| StorageService ONLY file with `localStorage.*` | ✅ PASS | Grep-verified (MockApiService comment is JSDoc only) |
| LoggerService ONLY non-test file with `console.*` | ✅ PASS | Grep: 0 production matches outside LoggerService.js |
| ≥6 conventional commits on `dev` | ✅ PASS | 7 commits confirmed |
| `git push origin dev` succeeded | ✅ PASS | origin/dev matches dev HEAD |

All 10 acceptance criteria: **PASS**.

---

## Findings

### CRITICAL findings

*(none)*

### MINOR findings

1. **`MockApiService.js:17`** — `const VALID_COLLECTIONS = ['users', 'exams', 'submissions']` is a hardcoded module-level constant. Like D002's `EMS_KEY_PREFIX`, this could get out of sync if ConfigService's storage key names change. The actual storage key lookups DO flow from ConfigService (via `this._keys[collection]`), but the validation gate does not. Recommended fix: move to constructor — `this._validCollections = Object.keys(config.getStorageKeys()).filter(k => k !== 'currentUser')` — and update `_key()` to use `this._validCollections`.

2. **`App.jsx:12`** — `mockApi.seedIfEmpty().then(() => setReady(true))` has no `.catch()` handler. If `seedIfEmpty()` rejects (e.g., storage quota exceeded), the rejection is unhandled, `ready` remains `false`, and the UI freezes at "Seeding demo data into localStorage…" indefinitely with no user feedback. Recommended fix:
   ```jsx
   mockApi.seedIfEmpty()
     .then(() => setReady(true))
     .catch((err) => { logger.error('seedIfEmpty failed: %s', err.message); setReady(true); });
   ```
   Marking `ready=true` on error ensures the UI at least renders (even without seeded data), and the logger records the failure.

3. **Implementer report table: MockApiService.test.js row** — Table claims 22 tests; actual count is 20 (verified by counting `it()` blocks; Vitest output of 106 confirms 20, not 22). No code defect — report-accuracy issue only. Both the 106 total and ≥22 cumulative spec requirements are met.

### NOTE findings

1. **`Submission.js:16`** — `VALID_STATUSES = ['submitted', 'graded']` — the spec §7 lists the `status` field but does not enumerate its valid values. The Implementer chose these values and flagged it as FQ #1. They are semantically correct. Team Lead should confirm with the lecturer before D007 (Submission flow) cements this API.

2. **`services/index.js`** — The D003 spec pseudo-code shows `new ConfigService()`, `new LoggerService()` etc. inside `index.js`. The Implementer re-exports the D002 default-exported singletons instead. This avoids creating duplicate instances (a real bug the pseudo-code would have caused). The Implementer flagged this as FQ #3. The approach is correct; the spec's pseudo-code was illustrative, not prescriptive. Team Lead should confirm this pattern is acceptable.

3. **`seedData.js`** — `getSeedData()` is a pure function returning a fresh object each call. However, the `SEED_IDS` values and the inline question objects within exams are plain object literals — callers who mutate the returned structure (e.g., `seed.exams[0].questions.push(...)`) would not affect subsequent calls since each call builds a new object. No functional issue; worth noting for M2 when seed data may be extended.

4. **`models/util.js`** — The `Math.random()` fallback UUID is not cryptographically random. Acceptable for M1 session-scoped IDs. If persistence (real DB) is introduced in M2, switch to `crypto.randomUUID()` without fallback (Node 19+ and all modern browsers support it).

---

## Follow-up questions for Team Lead

1. **(`Submission.VALID_STATUSES`)** — `['submitted', 'graded']` is Implementer-chosen (spec §7 doesn't enumerate). Confirm these are the right values before D007 locks the Submission API.

2. **(`services/index.js` re-export pattern vs `new` pattern)** — The D003 spec pseudo-code showed `new ConfigService()` etc. inside `index.js`. Implementer re-exports existing singletons to avoid duplicate instances — correctly. Confirm this pattern is acceptable for D004+ (all downstream services should import from `services/index.js`, not from individual service files).

3. **(`App.jsx .catch()` gap)** — MINOR finding #2 above. Is a fix commit required before D004 proceeds, or is it acceptable to address in D005 when App.jsx gets full routing?

---

## Verdict reasoning

All 10 D003 acceptance criteria pass independently. The Vitest suite ran 106/106 in my environment, well above the ≥22 cumulative minimum. Both grep constraints (localStorage and console exclusivity) are clean — the single `localStorage` match in MockApiService is in a JSDoc comment. All 7 commits are on `dev` and pushed. The production build adds 8 new modules cleanly (196.95 kB, no errors).

The two MINOR findings are quality improvements that carry no correctness risk in the current M1 scope: `VALID_COLLECTIONS` is a named constant (not inline literals) whose values happen to match ConfigService exactly, and the missing `.catch()` in App.jsx only matters if `seedIfEmpty` rejects — which it cannot in normal M1 operation (the mock seed data is valid and hardcoded). Neither blocks downstream D-tasks.

**Verdict: PASS**
