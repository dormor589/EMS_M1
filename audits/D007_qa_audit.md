# D007 — QA Audit Report

**Date:** 2026-05-24T00:20:00Z
**Auditing:** D007 (SubmissionService + Student flow: Dashboard, Available, Take, Grades + re-wire SubmissionsPage)
**Implementer report:** audits/D007_implementer_report.md
**Verdict:** PASS

---

## R14 sanity

N/A for M1 (mock-only deployment).

---

## Independent test run

```
 RUN  v4.1.7

 Test Files  11 passed (11)
      Tests  214 passed (214)
   Start at  00:00:07
   Duration  1.67s
```

**Cumulative requirement:** ≥44 — **214 PASS ✓**

New tests this D-task: 26 (SubmissionService.test.js). Verified by line tally:

| Suite | Tests |
|-------|-------|
| Constructor validation | 4 |
| submitExam — happy path | 4 |
| submitExam — rejects non-Published | 3 |
| submitExam — duplicate prevention | 2 |
| getSubmissionsByExam | 3 |
| getSubmissionsByStudent | 3 |
| getSubmissionByExamAndStudent | 2 |
| gradeSubmission | 3 |
| Input validation | 2 |
| **Total** | **26** |

Matches implementer report ✓

---

## Independent build

```
vite v8.0.14 building for production...
✓ 54 modules transformed
dist/index.html         0.45 kB │ gzip:  0.29 kB
dist/assets/*.css       7.06 kB │ gzip:  2.18 kB
dist/assets/*.js      286.07 kB │ gzip: 84.96 kB
✓ built in 111ms
```

Build: **PASS ✓** — 54 modules (up from 53 in D006; correct, 1 new file: SubmissionService).

---

## Grep constraint verification (D007 new/modified files)

Scope: `SubmissionService.js`, `services/index.js`, `StudentDashboard.jsx`, `AvailableExamsPage.jsx`, `TakeExamPage.jsx`, `GradesPage.jsx`, `SubmissionsPage.jsx` (teacher, re-wired).

### localStorage — StorageService.js ONLY

```
grep -n "localStorage" [D007 production files]
→ src/services/index.js:31: * MockApiService singleton — CRUD over localStorage-backed mock DB.
→ src/pages/student/TakeExamPage.jsx:113: // StorageService is the ONLY file allowed to touch localStorage.
```

Both hits are prose/comments, not `localStorage.` accessor calls. Actual storage operations in `TakeExamPage.jsx` go through the `storage` singleton (StorageService):
- `TakeExamPage:89`  — `storage.get(draftKey(...))`
- `TakeExamPage:116` — `storage.set(draftKey(...), updated)`
- `TakeExamPage:151` — `storage.remove(draftKey(...))`

These are StorageService method calls, not direct `localStorage.*` references. **PASS ✓**

### console.* — LoggerService.js ONLY

```
grep -n "console\." [D007 production files]
→ NONE FOUND
```
**PASS ✓**

---

## Git log verification

D007 commits on `dev` (above D006 close marker `97de030`):

| SHA | Message | Conventional? |
|-----|---------|---------------|
| 8ca58df | `feat: add SubmissionService with submit and query methods` | ✅ |
| 3bdb1bc | `feat: add StudentDashboard with counters` | ✅ |
| 8fe447f | `feat: add AvailableExamsPage (Published only, hides already-submitted)` | ✅ |
| 7a736fc | `feat: add TakeExamPage with radio MC, textarea open-text, draft save, submit` | ✅ |
| 91535ec | `feat: add GradesPage with submission list and grade display` | ✅ |
| 8ddc77e | `feat: wire teacher SubmissionsPage to real submission data` | ✅ |
| 740618a | `test: add Vitest tests for SubmissionService (26 tests)` | ✅ |
| 6f9f770 | `docs: update ai-work-log with D007 entry` | ✅ |

**8 conventional commits on `dev` — ≥7 required ✓**

`origin/dev` HEAD matches local `dev` (fdca2b4). **Pushed ✓**

---

## CRITICAL spec checks

### 1. AvailableExamsPage filters Published AND excludes already-submitted by current student

**`AvailableExamsPage.jsx:37–47`:**
```js
Promise.all([
  examService.getPublishedExams(),
  submissionService.getSubmissionsByStudent(user.id),
])
.then(([publishedExams, mySubmissions]) => {
  const submittedExamIds = new Set(mySubmissions.map((s) => s.examId));
  const available = publishedExams.filter((e) => !submittedExamIds.has(e.id));
  setExams(available);
})
```

Two-step filter:
1. `getPublishedExams()` — service returns only `status === 'Published'` records. Not filtering in JSX — delegating to service. ✓
2. Subtract already-submitted exams using a `Set` lookup on `examId`. O(1) lookup per exam. ✓
Both fetches run concurrently via `Promise.all` — no waterfall. ✓

**CRITICAL PASS ✓**

---

### 2. Student CANNOT see Draft or Closed exams

**Three independent enforcement layers:**

**Layer 1 — ExamService.getPublishedExams() (used by AvailableExamsPage + StudentDashboard):**
```js
const published = exams.filter((e) => e.status === 'Published');
```
Draft and Closed records are never returned. Students cannot see them from the Available Exams list. ✓

**Layer 2 — TakeExamPage guard (`TakeExamPage.jsx:72–78`):**
```js
if (foundExam.status !== 'Published') {
  setError(`This exam is not currently available (status: ${foundExam.status}).`);
  setLoading(false);
  return;
}
```
URL manipulation (e.g., `/student/exams/<draft-exam-id>`) hits this guard. A Draft or Closed exam ID renders an error page, not the question form. ✓

**Layer 3 — SubmissionService.submitExam guard (`SubmissionService.js:66–70`):**
```js
if (exam.status !== 'Published') {
  throw new Error(`SubmissionService.submitExam: exam is not Published (status="${exam.status}")`);
}
```
Service rejects a submission attempt for any non-Published exam. Even if layers 1 and 2 were bypassed (impossible through normal UI), the service enforces the constraint. ✓

**Tests confirming Layer 3:**
- "throws when exam is Draft" → rejects with `/not Published/i` ✓
- "throws when exam is Closed" → rejects with `/not Published/i` ✓

**CRITICAL PASS ✓** — Defense in depth: UI gate (getPublishedExams) + page guard + service guard.

---

### 3. submitExam throws on duplicate submission for same (examId, studentId)

**`SubmissionService.js:72–76`:**
```js
const existing = await this.getSubmissionByExamAndStudent(examId, studentId);
if (existing) {
  throw new Error('Already submitted');
}
```

**`getSubmissionByExamAndStudent` (`SubmissionService.js:151–155`):**
```js
const all = await this._mockApi.get('submissions');
return all.find((s) => s.examId === examId && s.studentId === studentId) || null;
```

Guard fires before the `mockApi.post` call — no duplicate record is ever written. Error message is exactly `'Already submitted'`. ✓

Test "throws 'Already submitted' on second submit for same (examId, studentId)" uses `.toThrow('Already submitted')` (exact match). ✓

Secondary test "allows a DIFFERENT student to submit the same exam" confirms the guard is scoped to `(examId, studentId)` pair, not just `examId`. ✓

**CRITICAL PASS ✓**

---

### 4. TakeExamPage renders both MC (radio) and open-text (textarea)

**MC branch (`TakeExamPage.jsx:237–265`):**
```jsx
{q.type === 'multiple-choice' && (
  <fieldset ...>
    {(q.options || []).map((opt, oi) => (
      <label key={oi} ...>
        <input
          type="radio"
          name={`question-${q.id}`}
          value={opt}
          checked={answers[q.id] === opt}
          onChange={() => handleAnswer(q.id, opt)}
        />
        {opt}
      </label>
    ))}
  </fieldset>
)}
```
Radio inputs grouped by `name={question-${q.id}}` — standard radio group; only one option selectable per question. ✓

**Open-text branch (`TakeExamPage.jsx:268–283`):**
```jsx
{q.type === 'open-text' && (
  <textarea
    id={`ot-${q.id}`}
    rows={4}
    value={answers[q.id] || ''}
    onChange={(e) => handleAnswer(q.id, e.target.value)}
    placeholder="Write your answer here…"
  />
)}
```
Textarea with controlled value and `htmlFor` linkage. ✓

Both branches are mutually exclusive via explicit type checks. ✓

**CRITICAL PASS ✓**

---

### 5. SubmissionsPage shows submissions per teacher's exam

**`SubmissionsPage.jsx:39–58` (teacher side, re-wired):**
```js
Promise.all([
  examService.getExamsByTeacher(user.id),   // teacher's own exams only
  mockApi.get('submissions'),               // all submissions
])
.then(([myExams, allSubmissions]) => {
  const myExamIds = new Set(myExams.map((e) => e.id));
  const mine = allSubmissions.filter((s) => myExamIds.has(s.examId));
  const grouped = myExams.map((exam) => ({
    exam,
    submissions: mine.filter((s) => s.examId === exam.id)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt)),
  }));
  grouped.sort((a, b) => b.submissions.length - a.submissions.length);
  setGroups(grouped);
})
```

Scoped to teacher's exams (`getExamsByTeacher(user.id)`). Student submissions for other teachers' exams are filtered out by `myExamIds` Set. Results are grouped per exam and sorted newest-first. ✓

**Note:** `mockApi.get('submissions')` is called directly (not through `submissionService`). `SubmissionService` has no `getAllSubmissions()` method, and calling `getSubmissionsByExam` per exam would be N+1. The 2-call pattern is the correct architectural choice for this read path. Not a finding.

**CRITICAL PASS ✓**

---

### 6. localStorage outside StorageService / console.* outside LoggerService

As documented in grep results above:
- Only JSDoc comments and inline code-comments mention "localStorage" — no `localStorage.*` accessor calls.
- `TakeExamPage` draft saves go through the `storage` singleton (StorageService methods `get/set/remove`).
- No `console.*` calls anywhere in D007 production files.

**CRITICAL PASS ✓** (both constraints)

---

## Spec verification checklist (§7 Submission entity fields)

| Field | submitExam implementation | Result |
|-------|--------------------------|--------|
| `id` | `generateId()` (crypto.randomUUID) | ✅ |
| `examId` | from argument | ✅ |
| `studentId` | from argument | ✅ |
| `answers` | `Array.isArray(answers) ? answers : []` | ✅ |
| `status` | hardcoded `'submitted'` on create | ✅ |
| `grade` | `null` on create | ✅ |
| `feedback` | `''` on create | ✅ |
| `submittedAt` | `new Date().toISOString()` | ✅ |

---

## Test critique

### Spec-required test coverage (D007 §Tests)

| Spec requirement | Test | Coverage |
|-----------------|------|----------|
| submitExam happy path | "persists a submission with status 'submitted'" | ✅ |
| submitExam rejects exam status != Published | "throws when exam is Draft" + "throws when exam is Closed" | ✅ |
| submitExam rejects double-submission | "throws 'Already submitted' on second submit" | ✅ |
| getSubmissionsByStudent filters correctly | "returns only submissions by the specified student" | ✅ |
| getSubmissionsByExam filters correctly | "returns only submissions for the specified exam" | ✅ |
| gradeSubmission updates fields | "updates grade and feedback, sets status to 'graded'" | ✅ |

All spec-required tests present and passing ✓

### Notable edge-case tests (beyond spec minimum)

- "allows a DIFFERENT student to submit the same exam" — confirms duplicate guard is pair-scoped ✓
- "throws when exam does not exist" — covers ghost-ID case ✓
- "sets grade = null and feedback = '' on initial submit" — entity-field defaults ✓
- "persists answers array as-is" — verifies answers payload is stored intact ✓

### Untested edge cases (informational)

1. `submitExam` with `answers` = `undefined` — code defaults to `[]` (`Array.isArray(undefined)` is false → `[]`). Correct behavior, not explicitly tested. Low risk.
2. `getSubmissionByExamAndStudent` with missing `studentId` — throws per line 153. Not directly tested (it is exercised indirectly by all `submitExam` duplicate-guard paths). Coverage gap is minor.
3. `gradeSubmission` with `grade = 0` — `grade: 0` is falsy; `GradesPage:107` checks `s.grade !== null && s.grade !== undefined`. A grade of 0 would be displayed correctly as `<strong>0</strong>`. Test coverage for grade=0 is absent but the logic is correct. Low risk.

---

## Architecture review

### Dependency chain — no cycles

```
config, logger → storage, notify → mockApi → auth, examService → submissionService
```
`services/index.js` wires `submissionService = new SubmissionService(mockApi, examService, config, logger)`. Dependency order preserved. No circular imports. ✓

### SubmissionService correctly uses examService (not mockApi) for exam lookup

`submitExam` uses `this._examService.getExamById(examId)` for exam lookup (line 62), not `this._mockApi.getById('exams', examId)`. This respects service boundaries: exam queries go through ExamService. ✓

### Promise.all concurrency

StudentDashboard, AvailableExamsPage, GradesPage, and the re-wired SubmissionsPage all use `Promise.all` for concurrent data fetching. No waterfall N+1 patterns. ✓

### TakeExamPage draft key pattern

Key: `` `ems_draft_${examId}_${studentId}` `` — matches spec §5.2 pattern. Draft cleared on successful submit. Stale keys (exam closed without student completing) are harmless (`StorageService.clear()` removes all `ems_*` keys). Documented in implementer report as M2 TTL-cleanup concern. ✓

---

## Manual UX Re-Validation

D007 closes the student flow loop. Full end-to-end session performed:

1. **App loads** → `/login`. ✓
2. **Login as teacher** (`teacher@ems.dev / password`) → `/teacher`. TeacherDashboard loads. Published seed exam visible in My Exams. ✓
3. **Logout** → `/login`. ✓
4. **Login as student** (`student@ems.dev / password`) → `/student`. StudentDashboard shows: Available=1, Submitted=0, Graded=0 (1 Published exam from seed). ✓
5. **Navigate to Available Exams** → 1 exam visible (Published seed exam). NO Draft exam shown. ✓
6. **Clicked Start Exam** → TakeExamPage loads. 2 questions rendered: Q1 = multiple-choice (radio buttons, 3 options), Q2 = open-text (textarea). ✓
7. **Answered Q1** (selected radio option) and **Q2** (typed answer). Unanswered warning does NOT appear. ✓
8. **Submitted answers** → "Exam submitted successfully!" notification. Navigated to GradesPage. ✓
9. **GradesPage** shows 1 row: exam title, submitted timestamp, status badge "submitted", "Not yet graded", "—". ✓
10. **Refresh (hard)** → GradesPage shows same row (submission persists in localStorage via StorageService). ✓
11. **Navigated back to Available Exams** → list is empty (submitted exam is hidden). ✓
12. **StudentDashboard after submit** → Available=0, Submitted=1, Graded=0. ✓
13. **Attempted URL navigation** to a Draft exam by crafting `/student/exams/<draft-exam-id>` → TakeExamPage shows "Exam Unavailable — This exam is not currently available (status: Draft)." ✓
14. **Teacher login → SubmissionsPage** → Shows grouped view: 1 submission under "Introduction to Algebra" (Published exam). Student ID, timestamp, status "submitted", grade "—", "2 answers". ✓
15. **Cannot submit same exam twice** — refreshed browser, returned to `/student/exams`, list is empty. Exam no longer available to this student. Service-layer duplicate guard also verified (SubmissionService tests). ✓

**All relevant D007 acceptance criteria satisfied in manual UX session.**

---

## Findings

### CRITICAL findings

*(none)*

---

### MINOR findings

**MINOR-1 (escalated — now in 5 consecutive D-tasks): missing `.catch()` on Promise chains**

Three new instances in D007:

- `StudentDashboard.jsx:38–54` — `Promise.all([...]).then([...]).finally(...)` — no `.catch()`. Errors are silently swallowed; student sees a frozen "loading" spinner.
- `AvailableExamsPage.jsx:37–47` — same pattern; error leaves list empty with no feedback.
- `GradesPage.jsx:35–55` — same pattern.

Note: `SubmissionsPage.jsx` (teacher, re-wired in D007) DOES have `.catch((err) => notify.error(err.message))` at line 62. `TakeExamPage` also has `.catch()` on both its load and submit promises. The student pages introduced in D007 regressed.

**Pattern history:** App.jsx (D003), App.jsx (D004), App.jsx (D005), TeacherDashboard (D006), App.jsx (D006), now StudentDashboard + AvailableExamsPage + GradesPage (D007). This is now a systemic pattern, not an isolated miss.

**Recommended fix:** Add `.catch((err) => notify.error(err.message))` to all three affected pages. Team Lead should add this as an explicit acceptance criterion in D008 (or dispatch a standalone ≤5-min fix).

---

### NOTE findings

**NOTE-1** — `SubmissionsPage.jsx` (teacher) calls `mockApi.get('submissions')` directly rather than through `submissionService`. `SubmissionService` has no `getAllSubmissions()` method, and per-exam calls would be N+1. The current 2-call pattern is the correct design. If `SubmissionService` grows a `getAllSubmissions()` or `getSubmissionsByTeacher(teacherId)` method in M2, this page should be updated. For now: correct and efficient.

**NOTE-2** — `TeacherDashboard` `submissionsCount` is still hardcoded to `0` (D006 stub). Now that `submissionService` is available, this could be updated to `submissionService.getSubmissionsByExam()` per exam, or a new `getSubmissionsCountForTeacher(teacherId)` helper. D007 implementer noted this as a D008-or-later change. Acceptable per spec §5.2 (Nice-to-Have).

**NOTE-3** — Draft key cleanup: `ems_draft_${examId}_${studentId}` keys are not expired on exam closure or deletion. Stale keys are harmless in M1 (they hold plain JSON, are never re-read after exam closes). M2 should add TTL-based cleanup or explicit eviction on exam state changes.

**NOTE-4** — `GradesPage` calls `examService.getAllExams()` (not `getPublishedExams`) to build the exam title lookup map. This is correct — a student's submission might be for an exam that was subsequently closed, and the title should still be resolvable. Using `getAllExams()` is the right choice here.

---

## Follow-up questions for Team Lead

1. **(MINOR-1 — systemic `.catch()` pattern)** Five D-tasks in a row have introduced Promise chains without `.catch()`. Three new instances in D007 student pages. Should D008 include an explicit acceptance criterion "all async data fetches in new/modified pages must have `.catch((err) => notify.error(err.message))`"? A sweep of existing pages for this fix would also be appropriate.

2. **(TeacherDashboard submissions counter)** Now that SubmissionService exists, updating the hardcoded `submissionsCount = 0` is a ~3-line change. Should this be folded into D008 or handled as a standalone fix?

*(No open spec ambiguities.)*

---

## Acceptance criteria matrix

| Criterion | Evidence | Result |
|-----------|----------|--------|
| Student sees only PUBLISHED exams in AvailableExamsPage | Code trace: `getPublishedExams()` service filter + test | ✅ |
| Student CANNOT see Draft or Closed exams (CRITICAL) | 3-layer enforcement: service filter + page guard + submit guard | ✅ |
| Student submits exam, persists across refresh | Manual UX: hard-refresh confirmed submission in GradesPage | ✅ |
| Student CANNOT submit same exam twice | Code trace + "throws 'Already submitted'" test + Manual UX | ✅ |
| Teacher SubmissionsPage shows real submission data | Code trace + Manual UX: submission appeared after student submit | ✅ |
| MC questions rendered as radio buttons | Code trace: `<input type="radio"` per option + Manual UX | ✅ |
| Open-text questions rendered as textarea | Code trace: `<textarea` + Manual UX | ✅ |
| AvailableExamsPage hides already-submitted exams | Code trace + Manual UX: list empty after submit | ✅ |
| Cumulative ≥44 tests | 214/214 Vitest ✓ | ✅ |
| localStorage only in StorageService | grep — only prose comments; draft ops through `storage` singleton | ✅ |
| console.* only in LoggerService | grep NONE FOUND | ✅ |
| Build passes | 111ms, 54 modules, 0 errors | ✅ |
| ≥7 conventional commits on `dev` | 8 commits verified | ✅ |
| origin/dev pushed | HEAD matches local | ✅ |

---

## Verdict: PASS

All CRITICAL spec requirements satisfied. AvailableExamsPage correctly applies the two-filter chain (Published-only via service + submitted-exam exclusion via Set lookup). Student cannot reach Draft/Closed exams via three independent enforcement layers. Duplicate submission prevention is enforced in the service with an exact "Already submitted" error. MC and open-text question rendering is correct. Teacher SubmissionsPage shows real grouped submission data scoped to the teacher's exams. Grep constraints clean. 214/214 tests pass. Build clean. 8 conventional commits on dev. Manual UX session confirmed the full student flow end-to-end including persistence and the teacher's visibility of submissions.

One systemic MINOR (missing `.catch()`) is now in 5 consecutive D-tasks across 8 affected files. This warrants Team Lead action in D008 as an explicit acceptance criterion — it is not a blocker for D007 PASS since errors in these paths are non-fatal (empty state rather than crash), but the pattern should not continue to grow.
