# D006 — QA Audit Report

**Date:** 2026-05-24T00:05:00Z
**Auditing:** D006 (ExamService + Teacher pages: Dashboard, Exams list, Create, Edit, Submissions stub)
**Implementer report:** audits/D006_implementer_report.md
**Verdict:** PASS

---

## R14 sanity

N/A for M1 (mock-only deployment).

---

## Independent test run

```
 RUN  v4.1.7

 Test Files  10 passed (10)
      Tests  188 passed (188)
   Start at  23:49:12
   Duration  2.02s
```

**Cumulative requirement:** ≥38 — **188 PASS ✓**

New tests this D-task: 38 (ExamService.test.js). Count verified by line tally:

| Suite | Tests |
|-------|-------|
| Constructor validation | 3 |
| createExam | 9 |
| getAllExams | 2 |
| getPublishedExams | 2 |
| getExamsByTeacher | 3 |
| getExamById | 3 |
| publishExam | 5 |
| closeExam | 5 |
| updateExam | 4 |
| deleteExam | 2 |
| **Total** | **38** |

Matches implementer report ✓

---

## Independent build

```
vite v8.0.14 building for production...
✓ 53 modules transformed
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/*.css                 7.06 kB │ gzip:  2.18 kB
dist/assets/*.js               272.82 kB │ gzip: 82.79 kB
✓ built in 103ms
```

Build: **PASS ✓** — 53 modules (up from 51 in D005; correct, 2 new files: ExamService + pages.css).

---

## Grep constraint verification (D006 new/modified files)

Scope: `ExamService.js`, `services/index.js`, `TeacherDashboard.jsx`, `TeacherExamsPage.jsx`, `CreateExamPage.jsx`, `EditExamPage.jsx`, `SubmissionsPage.jsx`.

### localStorage — StorageService.js ONLY

```
grep -rn "localStorage" [D006 production files]
→ src/services/index.js:29: * MockApiService singleton — CRUD over localStorage-backed mock DB.
```

Hit is a JSDoc comment (`@description` prose), not a `localStorage.` accessor call. No actual `localStorage.` reference in any D006 production code.
**PASS ✓**

### console.* — LoggerService.js ONLY

```
grep -rn "console\." [D006 production files]
→ NONE FOUND
```
**PASS ✓**

---

## Git log verification

D006 commits on `dev` (above D005 close marker `0bd34c5`):

| SHA | Message | Conventional? |
|-----|---------|---------------|
| c8f4880 | `feat: add ExamService with CRUD and status state machine` | ✅ |
| 10a4b87 | `style: add teacher page styles (badges, table, form, question editor)` | ✅ |
| c8658d9 | `feat: add TeacherDashboard with exam counters` | ✅ |
| f17c0c6 | `feat: add TeacherExamsPage with publish and close actions` | ✅ |
| e14b158 | `feat: add CreateExamPage with question editor` | ✅ |
| 24911fc | `feat: add EditExamPage with pre-filled question editor` | ✅ |
| f61b252 | `feat: add SubmissionsPage stub (full wiring in D007)` | ✅ |
| f6944cf | `test: add Vitest tests for ExamService (38 tests)` | ✅ |
| 01436d9 | `docs: update ai-work-log with D006 entry` | ✅ |

**9 conventional commits on `dev` — ≥7 required ✓**

Note: `10a4b87 style:` commit was not listed in D006's required commit structure, but it is a valid conventional commit for the addition of `pages.css`. Acceptable — commit count still satisfies the ≥7 requirement.

`origin/dev` HEAD matches local `dev` (bb72136). **Pushed ✓**

---

## CRITICAL spec checks

### 1. State machine enforced in service: Draft→Published OK; Published→Draft throws; Draft→Closed throws

**`publishExam()` — `ExamService.js:215–229`:**
```js
if (existing.status !== 'Draft') {
  throw new Error(`Invalid status transition: ${existing.status} → Published`);
}
```
- Draft→Published: condition false, proceeds ✓
- Published→Published: throws "Invalid status transition: Published → Published" ✓
- Closed→Published: throws "Invalid status transition: Closed → Published" ✓

**`closeExam()` — `ExamService.js:243–257`:**
```js
if (existing.status !== 'Published') {
  throw new Error(`Invalid status transition: ${existing.status} → Closed`);
}
```
- Published→Closed: condition false, proceeds ✓
- Draft→Closed: throws "Invalid status transition: Draft → Closed" ✓
- Closed→Closed: throws "Invalid status transition: Closed → Closed" ✓

**`updateExam()` bypass prevention — `ExamService.js:185`:**
```js
const { status: _s, id: _i, createdAt: _c, ...safePartial } = partial || {};
```
Status stripped from any partial update. A call to `updateExam(id, { status: 'Published' })` leaves status unchanged at 'Draft'.
Test "strips the status field from partial (status unchanged)" verifies this ✓

**CRITICAL PASS ✓** — State machine exclusively enforced in `publishExam()` and `closeExam()`. Both paths exercised by 10 transition tests (5 publishExam + 5 closeExam).

---

### 2. TeacherExamsPage filters by createdBy (teacher does not see another teacher's exams)

**`TeacherExamsPage.jsx:31–41`:**
```js
const user = auth.getCurrentUser();
// ...
examService.getExamsByTeacher(user.id)
  .then((data) => setExams(data))
```

**`ExamService.getExamsByTeacher — ExamService.js:70–82`:**
```js
const exams = await this._mockApi.get('exams');
const mine = exams.filter((e) => e.createdBy === teacherId);
```

End-to-end: page reads logged-in teacher's `id` from auth, passes it to `getExamsByTeacher`, service filters by `e.createdBy === teacherId`. A second teacher's exams (different `createdBy`) are never included.

**Test coverage:** "returns only exams created by the specified teacher" seeds teacher-A and teacher-B exams, queries teacher-A, verifies only 1 result with `createdBy === 'teacher-A'`. ✓

**CRITICAL PASS ✓**

---

### 3. No business logic in JSX — CRUD/state-machine in service

- **State machine transitions:** `handlePublish()` and `handleClose()` in `TeacherExamsPage.jsx:50–68` call `examService.publishExam()/closeExam()` and do nothing except notify + refresh list. No status comparison or string manipulation in the component. ✓
- **Exam creation:** `handleSubmit()` in `CreateExamPage.jsx:206–239` calls `examService.createExam(...)` for persistence. No direct `mockApi` call or storage operation. ✓
- **Exam update:** `handleSubmit()` in `EditExamPage.jsx:236–255` calls `examService.updateExam(...)`. No status field included in the partial (intentional; status already stripped in service too as defense-in-depth). ✓
- **Form validation in JSX:** `CreateExamPage:210–215` — checks `questions.length === 0` before calling service. This is UI-layer guard explicitly sanctioned by D006 spec ("Basic validation: title non-empty, at least 1 question") and OVERLAY ("form validation in components OK"). ✓
- **Status badge rendering** in `TeacherExamsPage.jsx:72–79` — pure display switch. Not business logic. ✓

**CRITICAL PASS ✓**

---

### 4. Spec-literal state machine error message format

D006 spec: `Invalid status transition: <from> → <to>`. 

Actual errors:
- `publishExam`: `Invalid status transition: ${existing.status} → Published` ✓
- `closeExam`: `Invalid status transition: ${existing.status} → Closed` ✓

Tests match exact format with regex (`/Invalid status transition: Published → Published/`, etc.). ✓

---

### 5. createExam sets status to ConfigService.getDefaultExamStatus()

`ExamService.js:130`: `const defaultStatus = this._config.getDefaultExamStatus(); // 'Draft'`
`ExamService.js:144`: `status: defaultStatus`

Not hardcoded — reads from ConfigService. ✓

---

### 6. createExam generates examId + stamps questions

`ExamService.js:129`: `const examId = generateId();` (crypto.randomUUID with fallback)
`ExamService.js:133–137`:
```js
const resolvedQuestions = (questions || []).map((q) => ({
  ...q,
  id:     q.id     || generateId(),
  examId: examId,
}));
```
Each question gets a `id` (if missing) and `examId = exam.id`. Test "assigns id and examId to each question" verifies. ✓

---

## Spec verification checklist (§7 Exam entity fields)

| Field | createExam implementation | Result |
|-------|--------------------------|--------|
| `id` | `generateId()` (crypto.randomUUID) | ✅ |
| `title` | `title.trim()` — validated non-empty | ✅ |
| `description` | `description \|\| ''` | ✅ |
| `durationMinutes` | `Number(durationMinutes)` — validated >0, finite | ✅ |
| `status` | `config.getDefaultExamStatus()` → 'Draft' | ✅ |
| `createdBy` | required field, validated non-empty | ✅ |
| `questions` | stamped with id + examId; defaults to [] | ✅ |
| `createdAt` | `new Date().toISOString()` | ✅ |

---

## Test critique

### Spec-required test coverage (D006 §Tests)

| Spec requirement | Test | Coverage |
|-----------------|------|----------|
| createExam stores with Draft status | "persists an exam with status Draft" | ✅ |
| createExam rejects empty title | "rejects when title is empty string" + "rejects when title is whitespace only" | ✅ |
| publishExam: Draft→Published succeeds | "transitions a Draft exam to Published" | ✅ |
| publishExam: Published→Published throws | "throws Invalid status transition when exam is already Published" | ✅ |
| closeExam: Published→Closed succeeds | "transitions a Published exam to Closed" | ✅ |
| closeExam: Draft→Closed throws | "throws Invalid status transition Draft → Closed" | ✅ |
| getPublishedExams returns only Published | "returns only Published exams" | ✅ |
| getExamsByTeacher filters by createdBy | "returns only exams created by the specified teacher" | ✅ |

All spec-required tests present. ✓

### Edge cases covered

- Status persists across re-read: "persists Published status (getExamById returns Published)" ✓
- updateExam strips status: "strips the status field from partial" ✓
- updateExam preserves createdAt: "preserves createdAt from the original exam" ✓
- Whitespace-only title rejected: separate test ✓
- durationMinutes = 0 rejected: "rejects when durationMinutes is 0" ✓
- durationMinutes = negative rejected: "rejects when durationMinutes is negative" ✓
- getExamsByTeacher with empty string → throws: "throws when teacherId is missing" ✓
- deleteExam removes from getAllExams: "removes the exam so it is no longer returned" ✓

### Untested edge cases (informational)

1. `durationMinutes` passed as `"abc"` (non-numeric string) — `Number("abc") = NaN`, `Number.isFinite(NaN)` = false → throws. Correct behavior but not tested. Minor gap; no risk to PASS.
2. `publishExam` on a non-existent exam ID — code path exists (line 219–221 throws "not found"), not directly tested. `getExamById` covers the "not found" return, but no `publishExam('bad-id')` test. Low risk; `updateExam` has "throws when exam not found" covering the pattern.
3. `getExamsByTeacher` when DB is entirely empty (no exams at all, not just zero for teacher) — returns `[]`. Covered implicitly by `getAllExams` empty test; not explicitly tested for `getExamsByTeacher`. Low risk.

---

## Architecture review

### Module boundaries

- ExamService imports only `../models/util.js` (for `generateId`) — no direct service imports in models ✓
- All teacher pages import from `../../services/index.js` only — no cross-page imports ✓
- `services/index.js` dependency chain: config/logger (no deps) → storage/notify → mockApi → auth → examService. No cycles. ✓

### QuestionEditor duplication

`QuestionEditor` is copy-pasted between `CreateExamPage.jsx` and `EditExamPage.jsx` (~130 lines each). Documented and intentional for M1 page independence. Acceptable for now; extraction to `components/shared/QuestionEditor.jsx` noted as M2 work. NOTE only.

### SubmissionsPage direct `mockApi` call

`SubmissionsPage.jsx:22`: `import { mockApi, auth, notify }` — calls `mockApi.get('submissions')` directly, bypassing the not-yet-existent `SubmissionService`. This is an acceptable stub pattern. D007 contract is clear: replace entirely. NOTE only.

---

## Security audit

- No hardcoded API keys or secrets in any new file ✓
- No URLs to external endpoints ✓
- No `console.*` calls in production code ✓
- No `localStorage.*` calls outside StorageService ✓

---

## Manual UX Re-Validation

D006 touches significant UI (5 teacher pages). Exercised via `npm run dev` with seed credentials.

**Session performed:**

1. **App loads** — `http://localhost:5173` → redirected to `/login` (unauth LandingRedirect). ✓
2. **Login as teacher** — `teacher@ems.dev` / `password` → redirected to `/teacher`. TeacherDashboard loads with counter cards: Total 2, Draft 1, Published 1, Closed 0, Submissions 0. (Seed data: 1 Draft + 1 Published exam.) ✓
3. **View My Exams** — `/teacher/exams`. Table shows 2 exams (teacher's exams only, filtered by `createdBy`). Seed exam "Introduction to Algebra" = Published (has Close button), "Advanced Calculus Topics" = Draft (has Publish button). ✓
4. **Create Exam** — `/teacher/exams/new`. Form loads with 1 blank question. Title="QA Test Exam", Duration=45, added 2 MC questions, submitted. → navigated to `/teacher/exams`, new exam visible in table as Draft with 2 questions. ✓
5. **Publish Exam** — clicked Publish on "QA Test Exam". Table refreshes; status badge → Published, button → Close. ✓
6. **Close Exam** — clicked Close on "QA Test Exam". Status badge → Closed; both action buttons disappear. ✓
7. **Edit Exam** — clicked Edit on a Draft exam. EditExamPage loads pre-filled (title, description, duration, questions from seed). Changed title, clicked Save. → navigated back to `/teacher/exams`, updated title shown. ✓
8. **Edit Published exam** — clicked Edit on the seed Published exam. Banner displayed: "⚠️ This exam is currently Published. All field edits are saved immediately..." ✓
9. **Refresh persistence** — after publishing "QA Test Exam" and navigating away, hard-refreshed browser. Exam still shows as Published. ✓
10. **Cannot close Draft directly** — attempted via URL manipulation / direct `examService.closeExam` call in browser console with a Draft exam ID → throws "Invalid status transition: Draft → Closed" (confirmed by network/state; UI doesn't expose this path). ✓
11. **SubmissionsPage** — `/teacher/submissions`. Shows "No submissions yet" with stub message. No crash. ✓
12. **Student cannot see teacher pages** — logged in as `student@ems.dev`, navigated to `/teacher/exams` → redirected to `/student` (ProtectedRoute from D005). ✓

**All relevant acceptance criteria satisfied in manual UX session.**

---

## Findings

### CRITICAL findings

*(none)*

---

### MINOR findings

**MINOR-1 (`SubmissionsPage.jsx:29–31`)** — Dead branch in stub:
```js
const user = auth.getCurrentUser();
setSubmissions(user ? all : all);
```
Both branches of the ternary are identical (`all`). The teacher-filter intent is noted in the comment but not implemented. No functional impact since this component is replaced in D007. Leave as-is (replacing in D007 is cleaner); document here for auditor completeness.

**MINOR-2 (`TeacherDashboard.jsx:29–33`)** — Missing `.catch()` on `getExamsByTeacher` Promise:
```js
examService
  .getExamsByTeacher(user.id)
  .then((data) => { setExams(data); })
  .finally(() => { setLoading(false); });
```
An unexpected error leaves the component in a no-error, empty-exams state with no user feedback. Same class of issue as App.jsx. Recommended fix: add `.catch((err) => notify.error(err.message))`.

**MINOR-3 (`App.jsx`)** — Missing `.catch()` on `seedIfEmpty()` — **4th consecutive D-task** (D003, D004, D005, D006). This has been flagged in every prior audit. Each successive D-task inherits without addressing it. **Team Lead action recommended before D007.**

---

### NOTE findings

**NOTE-1** — `QuestionEditor` duplicated between `CreateExamPage.jsx` and `EditExamPage.jsx`. Documented and intentional for M1. Extract to `components/shared/QuestionEditor.jsx` in M2 if shared use appears in D007/D008 (e.g., student TakeExamPage rendering questions read-only).

**NOTE-2** — `TeacherDashboard.jsx` shows a `Closed` counter not listed in the D006 spec's dashboard spec subset. It derives from the same `exams` array at no cost and doesn't hurt. Additive and harmless.

**NOTE-3** — `createExam` service-level validation does not require ≥1 question (documented: "can be empty initially"). UI enforces ≥1 question (CreateExamPage:210–213). This split (UI gate + permissive service) is intentional and correctly documented. If service-level ≥1-question validation is desired later, it's a one-line guard.

---

## Follow-up questions for Team Lead

1. **(App.jsx `.catch()` — 4th D-task)** MINOR-3 above has now been deferred through D003, D004, D005, and D006. Should this be added to D007 as an explicit acceptance criterion, or dispatched as a standalone <5-min fix between D-tasks?

2. **(SubmissionsPage stub → D007 contract)** Current stub calls `mockApi.get('submissions')` directly. D007 should fully replace the component with a version calling `SubmissionService.getSubmissionsByTeacher(teacherId)` (with ExamService cross-join). Is the D007 spec already drafted to reflect this, or should the Team Lead note it explicitly in D007?

*(No open spec ambiguities.)*

---

## Acceptance criteria matrix

| Criterion | Evidence | Result |
|-----------|----------|--------|
| Teacher can log in and navigate teacher area without crashes | Manual UX session: all 5 pages loaded | ✅ |
| Create exam with ≥2 questions; visible as Draft in TeacherExamsPage | Manual UX + ExamService.createExam test | ✅ |
| Publish exam — status flips, button updates | Manual UX + publishExam test | ✅ |
| Edit exam title/description and save | Manual UX + updateExam test | ✅ |
| Close a Published exam | Manual UX + closeExam test | ✅ |
| Refresh keeps state | Manual UX: hard-refresh confirmed Published status persists | ✅ |
| State machine enforced: cannot Close a Draft directly | Code trace + "throws Invalid status transition Draft → Closed" test | ✅ |
| TeacherExamsPage filters by createdBy | Code trace + getExamsByTeacher test + Manual UX | ✅ |
| No business logic in JSX | Code review: all CRUD/transitions delegate to ExamService | ✅ |
| localStorage only in StorageService | grep clean on all D006 files | ✅ |
| console.* only in LoggerService | grep clean on all D006 files | ✅ |
| Cumulative ≥38 tests | 188/188 Vitest ✓ | ✅ |
| ≥7 conventional commits on `dev` | 9 commits verified | ✅ |
| origin/dev pushed | HEAD matches local | ✅ |
| Build passes | 103ms, 53 modules, 0 errors | ✅ |

---

## Verdict: PASS

All CRITICAL spec requirements satisfied. The state machine is correctly enforced exclusively in the service layer with proper guard conditions and matching error messages. `TeacherExamsPage` correctly scopes to the logged-in teacher's exams via `getExamsByTeacher`. No business logic in JSX beyond sanctioned form validation. Grep constraints clean. 188/188 tests pass. Build clean. 9 conventional commits on dev. Manual UX session confirmed all 5 teacher pages function as specified.

Three MINORs noted. MINOR-1 (dead branch in stub) is harmless and resolved by D007 replacement. MINOR-2 (missing `.catch()` in TeacherDashboard) is a copy of the App.jsx pattern. MINOR-3 (App.jsx `.catch()` — 4th consecutive D-task without fix) is escalated to Team Lead for D007 action.
