# D010 — QA Audit Report

**Date:** 2026-05-24T03:00:00Z
**Auditing:** D010 (Minimal teacher submission review + grading UI)
**Implementer report:** audits/D010_implementer_report.md
**Tier:** 2 — MEDIUM risk (teacher UI + GradesPage; no auth/role/state-machine changes)
**Verdict:** PASS

---

## Scope

D010 adds:
1. `SubmissionDetailPage` at `/teacher/submissions/:id` — student answer review + grading form.
2. `getSubmissionById` accessor in `SubmissionService`.
3. `getUserById` accessor in `AuthService`.
4. Click-through link + Grade column in `SubmissionsPage`.
5. Route registration.
6. Tests for both new service methods.

QA independently ran build + tests, read all modified source files, verified all D010 acceptance criteria against code, checked constraints (localStorage/console), and inspected git state.

---

## R14 sanity

N/A for M1.

---

## Independent build + test run

| Check | Command | Result |
|-------|---------|--------|
| Build | `cd deployments/EMS_M1/client && npm run build` | ✅ 55 modules, 107ms, 0 warnings, 0 errors |
| Tests | `npx vitest run` | ✅ 221/221 PASS — 11 test files, 1.71s |

Both checks run independently by QA; not taken from implementer report. Module count increased from 54 (D009) to 55 — consistent with addition of `SubmissionDetailPage.jsx`.

---

## Git state verification

| Check | Result |
|-------|--------|
| `dev` local HEAD | `d2d0d5a chore: signal D010 report_complete in findings.jsonl` |
| `origin/dev` HEAD | matches local — **pushed ✓** |
| `main` commits | `11fe547 Initial bootstrap` — **untouched ✓** |
| Working tree | `deploy_requests/INDEX.jsonl` + `findings.jsonl` modified (Team Lead bookkeeping); `audits/D008_implementer.log.killed-by-quota` untracked (pre-existing artifact). No uncommitted source changes. ✓ |

D010 commits on `dev` (above D009 close marker):

| SHA | Message | Conventional? |
|-----|---------|---------------|
| `c3f4d19` | `feat: add getSubmissionById to SubmissionService and getUserById to AuthService` | ✅ |
| `953a5a5` | `feat: add SubmissionDetailPage with student answers and grading form` | ✅ |
| `e84cebd` | `feat: wire SubmissionsPage row links and Grade/Review action column` | ✅ |
| `14b02bb` | `chore: add /teacher/submissions/:id route (SubmissionDetailPage)` | ✅ |
| `6aae07d` | `test: add tests for getSubmissionById and getUserById (D010 grading flow)` | ✅ |
| `223203e` | `docs: append D010 entry to ai-work-log` | ✅ |

**6 conventional commits — ≥4 required ✓**

---

## Constraint verification

### localStorage exclusivity

```
grep -rn "localStorage\." src/ (excl. StorageService, tests)
→ NONE FOUND ✓
```

No new localStorage access outside `StorageService`. `SubmissionDetailPage` and updated `SubmissionsPage` both go through the service DI chain only. ✓

### console.* exclusivity

```
grep -rn "console\." src/ (excl. __tests__, *.test.*)
→ LoggerService.js only (4 permitted calls: console.info/warn/error/debug)
→ NONE in new or modified files ✓
```

---

## Critical check 1 — Route exists, wrapped in ProtectedRoute role="teacher"

`client/src/app/routes.jsx` line 75–77:

```jsx
<Route path="/teacher/submissions/:id" element={
  <ProtectedRoute role="teacher"><SubmissionDetailPage /></ProtectedRoute>
} />
```

`ProtectedRoute` implementation (verified in D005 audit):
- No user → `<Navigate to="/login" replace />`
- Wrong role → `<Navigate to={home} replace />` (student → `/student`)

The new route is correctly guarded. A student navigating to `/teacher/submissions/:id` is redirected to `/student`. An unauthenticated user is redirected to `/login`. **PASS ✓**

---

## Critical check 2 — SubmissionDetailPage renders required fields

`SubmissionDetailPage.jsx` verified fields in the header `<dl>`:

| Required field | Rendered | Source |
|----------------|----------|--------|
| Exam title | `exam.title` (line 191) | `examService.getExamById(sub.examId)` |
| Student name | `student.name + student.email` (line 198) | `auth.getUserById(sub.studentId)` |
| Submitted at | `new Date(submission.submittedAt).toLocaleString()` (line 203) | Submission record |
| Current grade | `submission.grade / 100` or "Not yet graded" (line 214) | Submission record |
| Status badge | `submission.status` (line 207) | Submission record |
| Each question text | `q.text` per `exam.questions` (line 247) | Exam record |
| Question type | `q.type` formatted label (line 252–259) | Exam record |
| Student answer | `answerFor(q.id)` → finds matching `answers` entry (line 286) | Submission record |

`answerFor(questionId)` implementation:
```js
function answerFor(questionId) {
  if (!submission?.answers) return '(no answer)';
  const found = submission.answers.find((a) => a.questionId === questionId);
  return found?.value?.trim() ? found.value : '(no answer)';
}
```
Correctly maps `questionId` to the student's submitted answer value. Falls back to `'(no answer)'` for unanswered questions. **PASS ✓**

---

## Critical check 3 — Grading form: 0–100 input + feedback textarea + save button

`SubmissionDetailPage.jsx` grading form (lines 303–355):

```jsx
<form onSubmit={handleSaveGrade} className="ems-form">
  <input type="number" min="0" max="100" step="1" required ... />
  <textarea rows={4} ... />
  <button type="submit">Save grade</button>
</form>
```

- `type="number" min="0" max="100" step="1" required` — browser-level validation. ✓
- Additional JS belt-and-suspenders in `handleSaveGrade` (lines 111–118):
  ```js
  const numGrade = Number(grade);
  if (grade === '' || isNaN(numGrade)) { setFormErr(...); return; }
  if (numGrade < 0 || numGrade > 100)  { setFormErr(...); return; }
  ```
  Catches empty string, NaN, and out-of-range values before any service call. ✓
- Feedback textarea is present and optional (no `required` attribute). ✓
- "Save grade" button: `disabled={saving}` while in-flight. ✓

**PASS ✓**

---

## Critical check 4 — Save calls existing SubmissionService.gradeSubmission (NOT re-implemented)

`handleSaveGrade` (line 123):
```js
await submissionService.gradeSubmission(submission.id, {
  grade:    numGrade,
  feedback: feedback.trim(),
});
```

`SubmissionService.gradeSubmission` was present since D007. D010 only added the thin `getSubmissionById` accessor alongside it. No re-implementation: the page delegates to the existing method. ✓

`gradeSubmission` body verified (lines 198–219):
- Fetches existing submission via `mockApi.getById`. ✓
- Spreads `...existing` with updated `grade`, `feedback`, `status: 'graded'`. ✓
- Persists via `mockApi.put('submissions', id, updated)`. ✓
- Logs via `this._logger.info(...)`. ✓

**PASS ✓**

---

## Critical check 5 — After save, GradesPage shows grade + feedback

Flow verified:
1. `handleSaveGrade` calls `gradeSubmission(id, { grade, feedback })`.
2. `gradeSubmission` updates the submission record in localStorage: `status: 'graded'`, `grade: <number>`, `feedback: <string>`.
3. `handleSaveGrade` then calls `await loadData()` — re-fetches the submission, updates `setSubmission(sub)`, which updates the header "Current grade" to `<strong>{submission.grade} / 100</strong>`. ✓
4. Student navigates to `/student/grades` → `GradesPage`.
5. `GradesPage` calls `submissionService.getSubmissionsByStudent(user.id)` → `mockApi.get('submissions')` → reads updated record from localStorage. ✓
6. `GradesPage` renders (lines 107–114):
   ```jsx
   {s.grade !== null && s.grade !== undefined
     ? <strong>{s.grade}</strong>
     : <span>Not yet graded</span>}
   ...
   {s.feedback || '—'}
   ```
   Non-null numeric grade renders as `<strong>{grade}</strong>`. Non-empty feedback renders as text. ✓

Data persistence confirmed: `MockApiService.put` calls `StorageService.set` (the only localStorage writer), which survives page reload. ✓

**PASS ✓**

---

## Critical check 6 — Pre-fill on already-graded submission

`loadData()` (lines 89–92):
```js
if (sub.grade !== null && sub.grade !== undefined) {
  setGrade(String(sub.grade));
  setFeedback(sub.feedback || '');
}
```

When a teacher revisits a previously-graded submission:
- `grade` state is initialized to the persisted grade value as a string. ✓
- `feedback` state is initialized to the persisted feedback string. ✓
- Form `value={grade}` and `value={feedback}` are controlled inputs — they pre-fill on render. ✓
- Form heading changes from "Grade This Submission" to "Update Grade" (`isGraded` flag, line 300). ✓

**PASS ✓**

---

## Critical check 7 — Out-of-scope features NOT built

Verified via full read of `SubmissionDetailPage.jsx` (362 lines):

| Out-of-scope item | Present? |
|-------------------|----------|
| Per-question grading (grade per question) | ✗ — single overall grade only |
| Automatic / AI grading | ✗ — no automated logic |
| Rich text editor for feedback | ✗ — plain `<textarea>` |
| Bulk grading / batch actions | ✗ — single-submission view only |
| Grade-release workflow | ✗ — grade stored directly |
| Notifications to student | ✗ — `notify.success()` is teacher-local only |
| Exam status transition on grade | ✗ — `gradeSubmission` only updates submission record |

The MC options display shows the correct answer (`✓ correct` annotation, lines 269–273) — this is read-only teacher reference, not per-question grading. In scope and appropriate. ✓

**PASS ✓**

---

## Critical check 8 — Failure mode handling

| Failure mode | Implementation |
|--------------|----------------|
| Submission not found (bad URL) | `getSubmissionById` returns null → `setDataError('Submission not found.')` → renders error banner + "← Back to Submissions" link (line 157–171) ✓ |
| Exam deleted (submission exists, exam null) | `foundExam` is null → `setExam(null)` → header shows "Exam no longer available" (line 193); question section shows "Exam data unavailable" (line 229) ✓ |
| Student deleted (submission exists, user null) | `foundStudent` is null → `setStudent(null)` → falls back to raw `studentId` UUID in monospace (line 199) ✓ |
| Grade out of range | JS validation in `handleSaveGrade` rejects before service call; inline `formErr` shown (lines 111–118) ✓ |

**PASS ✓**

---

## Critical check 9 — No business logic in JSX

- `getSubmissionById`, `getUserById`, `gradeSubmission` — all in service classes, not components. ✓
- Grade validation exists in both service caller (JSX) and is double-validated — the JSX guard (range check before calling service) is UI responsibility, not business logic. The service's `gradeSubmission` does the actual persist. ✓
- `answerFor()` is a pure render helper (array lookup + string comparison) — no mutation, no side effects, no business rule. Acceptable in component. ✓
- `SubmissionDetailPage` does not call `mockApi` directly — it goes through `submissionService`, `examService`, `auth` (DI chain). ✓
- `SubmissionsPage` still calls `mockApi.get('submissions')` directly (pre-existing D007 design; the 2-call strategy). Not introduced by D010; not a new finding.

**PASS ✓**

---

## Critical check 10 — New service methods

### `SubmissionService.getSubmissionById(id)`

```js
async getSubmissionById(id) {
  if (!id) throw new Error('SubmissionService.getSubmissionById: "id" is required');
  const record = await this._mockApi.getById('submissions', id);
  this._logger.info('SubmissionService.getSubmissionById: id=%s found=%s', id, !!record);
  return record ?? null;
}
```

- Missing id guard: ✓
- Delegates to `mockApi.getById` (thin wrapper — no business logic): ✓
- `?? null` normalizes `undefined` to `null`: ✓ (also redundant since `mockApi.getById` returns `|| null` itself — harmless double null-coalesce)
- Logger call: ✓

### `AuthService.getUserById(id)`

```js
async getUserById(id) {
  if (!id) throw new Error('AuthService.getUserById: "id" is required');
  return this._mockApi.getById('users', id);
}
```

- Missing id guard: ✓
- Returns `mockApi.getById` directly — `mockApi.getById` returns `records.find(...) || null`, so not-found returns `null`. ✓
- No `?? null` normalizer (unlike `getSubmissionById`) — inconsequential since `mockApi.getById` already returns `null` not `undefined`. Consistency note only; no bug.
- No logger call: This is the only new service method without a `this._logger.info()` call. See MINOR-2 below.

---

## Test coverage check

### New tests — `getSubmissionById` (4 tests in `SubmissionService.test.js`)

| Test | Verified |
|------|---------|
| Returns submission when it exists | ✅ |
| Returns null when submission does not exist | ✅ |
| Throws when id is missing | ✅ |
| `gradeSubmission` — grade persists and retrievable via `getSubmissionById` | ✅ — integration test: submit → grade → getById → assert grade/feedback/status |

**4 tests ✓**

### New tests — `getUserById` (3 tests in `AuthService.test.js`)

| Test | Verified |
|------|---------|
| Returns user record for known seeded user id | ✅ |
| Returns null for unknown id | ✅ |
| Throws when id is missing | ✅ |

**3 tests ✓**

Total new tests: 7. Spec required ≥2. ✓

---

## Manual UX Re-Validation

Method: code trace + service trace (M1 mock-only; all behavior deterministic from source). Independent of implementer annotations.

**UX flow traced:**

1. Teacher logs in (`teacher@ems.dev` / `password`) → redirected to `/teacher`. ✓
2. Teacher navigates "Submissions" → `/teacher/submissions`. `SubmissionsPage` loads; new "Grade" column visible (`s.grade !== null ? grade/100 : —`). For ungraded submissions, Action column shows "Grade" button. ✓
3. Teacher clicks "Grade" → navigates to `/teacher/submissions/:id`. `SubmissionDetailPage` mounts; `loadData()` fires:
   - Fetches submission by id. ✓
   - Concurrently fetches exam + student. ✓
   - Header shows: exam title, student name + email, submitted-at (localeString), "Not yet graded". ✓
   - Per-question section shows all questions with student answers. ✓
   - Grading form at bottom; `grade` and `feedback` state are empty (no prior grade). ✓
4. Teacher enters grade 85, feedback "Good work!", clicks "Save grade":
   - `handleSaveGrade` runs; both validations pass (number, in range). ✓
   - `submissionService.gradeSubmission(id, { grade: 85, feedback: 'Good work!' })` called. ✓
   - `mockApi.put` writes updated submission to localStorage. ✓
   - `loadData()` re-fetches; header updates to "85 / 100". ✓
   - `notify.success('Grade saved successfully.')` fires (UI silent — NotifyService gap, Known Limitation #7, pre-existing). ✓
5. Teacher revisits same submission URL: `loadData()` finds `sub.grade === 85 !== null` → `setGrade('85')`, `setFeedback('Good work!')`. Form pre-fills. Header shows "Review" (button label) + "85 / 100". ✓
6. Student logs in → `/student/grades`. `GradesPage` fetches submissions → finds graded record → renders `<strong>85</strong>` and "Good work!" feedback. ✓

All acceptance criteria satisfied by trace. ✓

---

## Findings

### CRITICAL findings

*(none)*

---

### MINOR findings

**MINOR-1 (`SubmissionDetailPage.jsx:311`, `SubmissionDetailPage.jsx:329`) — Wrong CSS class on form labels**

Both `<label>` elements in the grading form use `className="ems-form__group"` instead of `className="ems-form__label"`:

```jsx
// Line 311:
<label className="ems-form__group" htmlFor="grade-input">
// Line 329:
<label className="ems-form__group" htmlFor="feedback-input">
```

`ems-form__group` is the wrapper div class (`display: flex; flex-direction: column; gap: 0.3rem; margin-bottom: 1.1rem;`) and is not semantically correct on a `<label>`. The correct class `ems-form__label` exists in `pages.css` and is used elsewhere (`font-size: 0.875rem; font-weight: 600; color: #334155`).

Effect: Labels in the grading form receive container-level styling (flex layout, 1.1rem bottom margin) instead of label typography styling. Labels appear visually inconsistent with other forms (CreateExamPage, EditExamPage). Functionally the form submits correctly; no data is affected.

**Severity: MINOR** (styling inconsistency — per overlay MINOR list).
**Team Lead action**: waive or fix before final merge.

---

**MINOR-2 (`AuthService.js:196`) — `getUserById` missing logger call**

`getUserById` has no `this._logger.info(...)` call, unlike every other `AuthService` method and both new service methods (`getSubmissionById` has one). This is a minor observability inconsistency.

```js
async getUserById(id) {
  if (!id) throw new Error('AuthService.getUserById: "id" is required');
  return this._mockApi.getById('users', id); // ← no logger call
}
```

`getSubmissionById` by contrast (added in same commit):
```js
this._logger.info('SubmissionService.getSubmissionById: id=%s found=%s', id, !!record);
```

**Severity: MINOR** (missing observability — equivalent to "missing JSDoc on a service method" per overlay MINOR list).
**Team Lead action**: waive or fix before final merge.

---

### NOTE findings

**NOTE-1** — `answerFor(questionId)` is called three times per question render (once for `color` style, once for `fontStyle` style, once for the display value). In M1 scale (≤10 questions) this is imperceptible. Store the result in a `const ans = answerFor(q.id)` per iteration in M2 refactor.

**NOTE-2** — `getUserById` return type diverges from `getSubmissionById`: the former returns `mockApi.getById(...)` directly (no `?? null`), the latter adds `?? null`. Both return `null` for not-found in practice (since `mockApi.getById` uses `|| null`), but the `?? null` normalization makes intent explicit. M2 cleanup note only.

**NOTE-3** — `SubmissionsPage.jsx` (line 22) retains the direct `mockApi` import for the 2-call strategy. This is a pre-existing D007 design decision, not introduced by D010. Carries forward as-is.

**NOTE-4** — `GradesPage.jsx` still has no `.catch()` handler (pre-existing from D007; escalated in D007 audit as systemic pattern). Not a new D010 finding.

---

## Acceptance criteria matrix

| Criterion | Evidence | Result |
|-----------|----------|--------|
| Teacher clicks submission row → `/teacher/submissions/:id` with student name, exam title, timestamp, all questions + answers | `<Link to={...}>` in SubmissionsPage; SubmissionDetailPage header + per-question render verified | ✅ |
| Grade form accepts 0–100 + optional feedback; "Save grade" persists via existing service | `<input type="number" min=0 max=100>` + JS guard; calls existing `gradeSubmission` | ✅ |
| After saving, detail page shows new grade | `handleSaveGrade` calls `loadData()` on success; header "Current grade" updates | ✅ |
| Student GradesPage shows grade + feedback | `GradesPage` renders `s.grade` as `<strong>` and `s.feedback` as text; no changes needed | ✅ |
| Editing previously-graded submission pre-fills form | `loadData()` calls `setGrade(String(sub.grade))` + `setFeedback(sub.feedback)` when `sub.grade !== null` | ✅ |
| `npx vitest run` 100% PASS | 221/221 — run independently | ✅ |
| `npm run build` no new warnings | 0 warnings — run independently | ✅ |
| ≥4 conventional commits on `dev`, pushed | 6 commits, all on dev, pushed | ✅ |
| Route `/teacher/submissions/:id` wrapped in `ProtectedRoute role="teacher"` | `routes.jsx` line 75–77 verified | ✅ |
| No out-of-scope features implemented | Full page read — no per-question grading, AI, rich text, bulk actions | ✅ |
| No localStorage outside StorageService | grep verified — NONE FOUND | ✅ |
| No `console.*` outside LoggerService | grep verified — LoggerService only | ✅ |
| `main` untouched | Only `11fe547 Initial bootstrap` | ✅ |

---

## Verdict: PASS

All D010 acceptance criteria satisfied. Build clean (55 modules, 0 warnings). 221/221 tests pass. The new route is correctly ProtectedRoute-guarded. `SubmissionDetailPage` renders all required fields and handles all three failure modes (not-found, deleted exam, deleted student). The grading form validates 0–100 before calling the pre-existing `gradeSubmission` service method. Pre-fill works for re-grading. `GradesPage` correctly displays grades and feedback without changes. Seven new tests (4 + 3) cover both new service accessors. 6 conventional commits on `dev`, pushed; `main` untouched.

Two MINORs found and listed:
- **MINOR-1**: wrong CSS class (`ems-form__group` instead of `ems-form__label`) on both form labels — styling inconsistency, form functionally correct.
- **MINOR-2**: `getUserById` missing logger call — observability gap, no functional impact.

Both are waivable per overlay MINOR policy. Team Lead to decide: waive or request revision.
