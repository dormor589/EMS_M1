# D006 — Implementer Report

**Date:** 2026-05-23T23:55:00Z
**Status:** Submitted for QA review

---

## What was built

| File | Lines | Notes |
|------|-------|-------|
| `client/src/services/ExamService.js` | 232 | Full CRUD + state machine |
| `client/src/services/index.js` | +6 lines | Wire `examService` singleton |
| `client/src/styles/pages.css` | 328 | Buttons, badges, table, form, question editor, responsive |
| `client/src/main.jsx` | +1 line | Import `pages.css` |
| `client/src/pages/teacher/TeacherDashboard.jsx` | 94 | Counters + quick-links |
| `client/src/pages/teacher/TeacherExamsPage.jsx` | 162 | Table with Publish/Close actions |
| `client/src/pages/teacher/CreateExamPage.jsx` | 335 | Form with QuestionEditor (MC + open-text) |
| `client/src/pages/teacher/EditExamPage.jsx` | 382 | Pre-filled form; status banner; toEditorQuestion() |
| `client/src/pages/teacher/SubmissionsPage.jsx` | 101 | Stub; reads raw mock data; D007 replaces |
| `client/src/services/__tests__/ExamService.test.js` | 385 | 38 tests |

---

## Tests

```
 RUN  v4.1.7

 Test Files  10 passed (10)
      Tests  188 passed (188)
   Start at  23:45:26
   Duration  2.03s
```

| File | Tests | Result |
|------|-------|--------|
| ConfigService.test.js | 13 | ✅ PASS |
| LoggerService.test.js | 13 | ✅ PASS |
| StorageService.test.js | 14 | ✅ PASS |
| NotifyService.test.js | 11 | ✅ PASS |
| models.test.js | 35 | ✅ PASS |
| MockApiService.test.js | 22 | ✅ PASS |
| AuthService.test.js | 20 | ✅ PASS |
| NavigationMenu.test.jsx | 14 | ✅ PASS |
| ProtectedRoute.test.jsx | 8 | ✅ PASS |
| **ExamService.test.js** | **38** | **✅ PASS** |
| **Total** | **188** | **✅ ALL PASS** |

- New tests this D-task: 38
- Cumulative: 188/188 PASS (≥38 cumulative criterion ✅)

---

## R14 sanity result

**N/A for M1.**

---

## Performance benchmarks

- Vitest: 2.03s (10 test files, including React component rendering)
- Build: 103ms, 53 modules
- ExamService hot path: O(n) on exams collection for all filter operations. n is bounded by mock localStorage; acceptable for M1 scale.

---

## Acceptance criteria verification

| Criterion | Verified by | Result |
|-----------|-------------|--------|
| Teacher can log in and navigate teacher area without crashes | All 5 teacher pages load via ProtectedRoute guards (D005) | ✅ |
| Create exam with ≥2 questions, visible in TeacherExamsPage as Draft | ExamService.createExam sets status='Draft'; test `persists an exam with status Draft` | ✅ |
| Publish exam — status flips, button updates | publishExam() test; TeacherExamsPage re-fetches list after transition | ✅ |
| Edit exam title/description and save | updateExam() test `updates title and description` | ✅ |
| Close a Published exam | closeExam() test `transitions a Published exam to Closed` | ✅ |
| Refresh keeps state (persistence via MockApi → Storage) | MockApiService writes to localStorage; getExamsByTeacher reads it back | ✅ |
| State machine enforced: cannot Close a Draft directly | closeExam test `throws Invalid status transition Draft → Closed` | ✅ |
| State machine enforced: cannot Publish a Published exam | publishExam test `throws … already Published` | ✅ |
| Cumulative tests ≥38 pass | 188/188 | ✅ |
| ≥7 conventional commits on dev; pushed | 9 commits — see table below | ✅ |

---

## Grep constraint verification

### localStorage — StorageService.js ONLY ✅

Zero `localStorage.` calls in any new D006 file. All storage ops go through `mockApi` → `StorageService`.

### console.* — LoggerService.js ONLY ✅

Zero `console.*` calls in any new D006 file. All logging via `logger` (injected into ExamService).

---

## Architecture

### ExamService design

Constructor-injected (mockApi, config, logger). No direct `localStorage` access — delegates to `MockApiService` for all persistence.

**State machine** is enforced exclusively in `publishExam()` and `closeExam()`. These are the ONLY methods that write a status change. `updateExam()` strips `status`, `id`, and `createdAt` from any incoming partial to prevent bypass:

```
Draft ──→ Published ──→ Closed
(publishExam)    (closeExam)
```

Any other transition throws `Error('Invalid status transition: <from> → <to>')`.

**Question stamping**: `createExam()` generates a UUID `id` for the exam first, then maps each question to assign `id` (if missing) and `examId = exam.id`. `updateExam()` applies the same map when questions are included in the partial.

**updateExam policy for status**: The spec says "status must use the dedicated method." The implementation silently drops status from the partial rather than throwing, which is the correct M1 UX (an accidental `status: 'Published'` from form state doesn't corrupt data).

### Teacher pages — auth state

All teacher pages read `auth.getCurrentUser()` synchronously from StorageService (same pattern as D005's ProtectedRoute). On missing user, they navigate to `/login`. This is intentionally simple for M1.

### QuestionEditor sub-component

`QuestionEditor` is a local unexported component inside CreateExamPage and EditExamPage (duplicated). It is a pure display component — receives `question`, `index`, `onChange`, `onRemove` via props, emits changes upward. No service calls. The duplication is intentional for page independence in M1; extraction to `components/shared/QuestionEditor.jsx` is deferred to M2 if pages diverge further.

### SubmissionsPage stub policy

The stub calls `mockApi.get('submissions')` directly (not via ExamService) because `SubmissionService` doesn't exist yet. This is the minimum viable implementation — the route is navigable, doesn't crash on empty data, and shows a clear "wired in D007" notice. D007 replaces this entirely.

---

## Code complexity

- New production lines: ~1,300 (service + pages + styles)
- New test lines: ~385
- Cyclomatic complexity worst function: 5 (`QuestionEditor` in CreateExamPage — type switch, option rendering, conditional remove button)
- Number of TODO/FIXME: 0

---

## Self-review checklist

- [x] ExamService state machine enforced — Draft→Published, Published→Closed only ✅
- [x] Invalid transitions throw `Invalid status transition: X → Y` ✅ tested
- [x] TeacherExamsPage filters by `createdBy` (teacher ID) ✅ tested
- [x] Create form: title non-empty + ≥1 question client-side check ✅
- [x] Create form: MC supports ≥2 options with dynamic Add/Remove ✅
- [x] Edit form: pre-fills all fields from getExamById ✅
- [x] Edit form: status banner for Published/Closed exams ✅
- [x] updateExam strips status field ✅ tested
- [x] SubmissionsPage does not crash on empty submissions array ✅
- [x] 188/188 tests pass ✅
- [x] localStorage only in StorageService ✅ grep clean
- [x] console.* only in LoggerService ✅ grep clean
- [x] Build passes (103ms, 53 modules) ✅
- [x] ≥7 conventional commits (9 commits) ✅
- [x] No TODO/FIXME ✅

---

## Commits produced on `dev`

| SHA | Message |
|-----|---------|
| c8f4880 | `feat: add ExamService with CRUD and status state machine` |
| 10a4b87 | `style: add teacher page styles (badges, table, form, question editor)` |
| c8658d9 | `feat: add TeacherDashboard with exam counters` |
| f17c0c6 | `feat: add TeacherExamsPage with publish and close actions` |
| e14b158 | `feat: add CreateExamPage with question editor` |
| 24911fc | `feat: add EditExamPage with pre-filled question editor` |
| f61b252 | `feat: add SubmissionsPage stub (full wiring in D007)` |
| f6944cf | `test: add Vitest tests for ExamService (38 tests)` |
| 01436d9 | `docs: update ai-work-log with D006 entry` |

---

## Follow-up questions for Team Lead

1. **(QuestionEditor duplication)** — `QuestionEditor` is copy-pasted between `CreateExamPage` and `EditExamPage`. For M1 this is fine (pages are independent). If D007 or D008 requires a shared question-viewer for student TakeExamPage, extraction to `components/shared/QuestionEditor.jsx` should be done at that point.

2. **(SubmissionsPage D007 contract)** — SubmissionsPage currently calls `mockApi.get('submissions')` directly. D007 should fully replace the component with a version that calls `SubmissionService.getSubmissionsByTeacher(teacherId)` (after joining via ExamService). The current stub is clean to replace — no hidden coupling.

3. **(createExam allows empty questions array)** — The service validates title and durationMinutes but does NOT require ≥1 question (the spec says "can be empty initially; teacher fills via UI"). The CreateExamPage enforces ≥1 question as a UI constraint. This split is intentional and documented in ExamService JSDoc.
