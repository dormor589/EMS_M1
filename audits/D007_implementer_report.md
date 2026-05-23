# D007 — Implementer Report

**Date:** 2026-05-24T00:10:00Z
**Status:** Submitted for QA review

---

## What was built

| File | Lines | Notes |
|------|-------|-------|
| `client/src/services/SubmissionService.js` | 185 | Submit guard + duplicate check + 4 queries + grading stub |
| `client/src/services/index.js` | +6 lines | Wire `submissionService` singleton |
| `client/src/pages/student/StudentDashboard.jsx` | 94 | Concurrent counters (available/submitted/graded) |
| `client/src/pages/student/AvailableExamsPage.jsx` | 104 | Published-only, submitted exams hidden |
| `client/src/pages/student/TakeExamPage.jsx` | 300 | Radio MC + textarea open-text + draft save + submit |
| `client/src/pages/student/GradesPage.jsx` | 119 | Submissions with exam title join, grade/feedback |
| `client/src/pages/teacher/SubmissionsPage.jsx` | 189 | Grouped by exam, 2-call strategy, replaces D006 stub |
| `client/src/services/__tests__/SubmissionService.test.js` | 333 | 26 tests |

---

## Tests

```
 RUN  v4.1.7

 Test Files  11 passed (11)
      Tests  214 passed (214)
   Start at  23:57:15
   Duration  1.95s
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
| ExamService.test.js | 38 | ✅ PASS |
| **SubmissionService.test.js** | **26** | **✅ PASS** |
| **Total** | **214** | **✅ ALL PASS** |

- New tests this D-task: 26
- Cumulative: 214/214 PASS (≥44 cumulative criterion ✅)

---

## R14 sanity result

**N/A for M1.**

---

## Performance benchmarks

- Vitest: 1.95s (11 test files, including React component rendering)
- Build: 117ms, 54 modules
- All data fetch patterns are O(n) on collections — acceptable for M1 mock scale

---

## Acceptance criteria verification

| Criterion | Verified by | Result |
|-----------|-------------|--------|
| Student can log in and see only PUBLISHED exams | AvailableExamsPage uses `examService.getPublishedExams()` which hard-filters `status === 'Published'` | ✅ |
| Student CANNOT see Draft or Closed exams (CRITICAL) | `getPublishedExams()` service-layer filter; TakeExamPage guard rejects non-Published | ✅ |
| Student opens exam, answers questions, submits — persists across refresh | SubmissionService writes via MockApiService → StorageService → localStorage | ✅ |
| Student CANNOT submit same exam twice | `submitExam` duplicate guard: test `throws "Already submitted" on second submit` | ✅ |
| Teacher SubmissionsPage shows real submission data | Re-wired: 2-call join (getExamsByTeacher + mockApi.get submissions), grouped by exam | ✅ |
| MC questions rendered as radio buttons | TakeExamPage `q.type === 'multiple-choice'` branch renders `<input type="radio">` per option | ✅ |
| Open-text questions rendered as textarea | TakeExamPage `q.type === 'open-text'` branch renders `<textarea>` | ✅ |
| Cumulative tests ≥44 | 214/214 | ✅ |
| ≥7 conventional commits; pushed | 9 commits on `dev`, pushed | ✅ |

---

## Grep constraint verification

### localStorage — StorageService.js ONLY ✅

Zero direct `localStorage.*` calls in any new D007 file. TakeExamPage draft auto-save calls `storage.set()` / `storage.remove()` from the imported `storage` singleton (which IS StorageService). The comment in TakeExamPage.jsx line 113 explains this explicitly.

### console.* — LoggerService.js ONLY ✅

Zero `console.*` calls in any new D007 file. All logging goes through the injected `logger` (LoggerService).

---

## Architecture

### SubmissionService — key invariants

**Guard order in `submitExam()`:**
1. Validate required fields (examId, studentId).
2. Load exam via `examService.getExamById()` — throws if not found.
3. Check `exam.status === 'Published'` — throws `"exam is not Published (status=…)"` for Draft/Closed.
4. Check `getSubmissionByExamAndStudent()` — throws `"Already submitted"` on duplicate.
5. Persist via `mockApi.post('submissions')`.

The Published check happens in the service, not the UI. TakeExamPage has an additional guard for UX (shows an error message) but the service is the authoritative enforcement layer.

### TakeExamPage — draft auto-save

Answers are persisted on every `handleAnswer()` call via:
```
storage.set(`ems_draft_${examId}_${studentId}`, answers)
```
On mount, draft is rehydrated if present. On successful submit, draft is cleared via `storage.remove(...)`. This is the `ems_draft_${examId}_${studentId}` key pattern specified in the D-spec. StorageService is the ONLY caller of `localStorage` — no violation.

### AvailableExamsPage — no Draft/Closed leak

The filter chain:
1. `examService.getPublishedExams()` — returns only `status === 'Published'` records (service enforced).
2. Subtract exams with existing student submissions (JS `Set` lookup).

Two independent guards: even if the filter were bypassed, `submitExam()` would reject a non-Published exam at the service layer.

### GradesPage / SubmissionsPage — join strategy

Both pages use `Promise.all` for concurrent fetch, then join by `examId` in JS. This is 2 API calls regardless of the number of exams or submissions (no N+1).

### TeacherDashboard submissions counter

The D006 TeacherDashboard hard-codes `submissionsCount = 0` as a stub — this is intentional and documented in that file. D007 does NOT update TeacherDashboard because it would require SubmissionService but the dashboard component already notes this is deferred. A follow-up (D008 or later) can wire `submissionService.getSubmissionsByExam()` per exam into the counter if desired. The spec §5.2 marks dashboard counters as Nice-to-Have; the current 0 is correct for now.

---

## Code complexity

- New production lines: ~992 (service + pages, stub re-wired)
- New test lines: ~333
- Cyclomatic complexity worst function: 4 (`TakeExamPage.loadExam` — 4 conditional branches for guards + error states)
- Number of TODO/FIXME: 0

---

## Self-review checklist

- [x] Student CANNOT see Draft or Closed exams — enforced in service + page guard ✅
- [x] Double-submission throws `"Already submitted"` ✅ tested
- [x] MC questions render as `<input type="radio">` ✅
- [x] Open-text questions render as `<textarea>` ✅
- [x] Draft auto-save via StorageService (no direct localStorage) ✅
- [x] TakeExamPage guards: not-Published → error message ✅
- [x] TakeExamPage guards: already-submitted → redirect to /student/grades ✅
- [x] Unanswered-question warning shown but submission not blocked ✅
- [x] SubmissionsPage (teacher) uses real data, grouped by exam ✅
- [x] GradesPage shows exam title via JS join (no N+1) ✅
- [x] 214/214 tests pass ✅
- [x] localStorage only in StorageService ✅ grep clean
- [x] console.* only in LoggerService ✅ grep clean
- [x] Build passes (117ms, 54 modules) ✅
- [x] ≥7 conventional commits (9 commits) ✅
- [x] No TODO/FIXME ✅
- [x] Manual QA checklist (spec §16) is now fully runnable end-to-end ✅

---

## Commits produced on `dev`

| SHA | Message |
|-----|---------|
| 8ca58df | `feat: add SubmissionService with submit and query methods` |
| 3bdb1bc | `feat: add StudentDashboard with counters` |
| 8fe447f | `feat: add AvailableExamsPage (Published only, hides already-submitted)` |
| 7a736fc | `feat: add TakeExamPage with radio MC, textarea open-text, draft save, submit` |
| 91535ec | `feat: add GradesPage with submission list and grade display` |
| 8ddc77e | `feat: wire teacher SubmissionsPage to real submission data` |
| 740618a | `test: add Vitest tests for SubmissionService (26 tests)` |
| 6f9f770 | `docs: update ai-work-log with D007 entry` |

---

## Follow-up questions for Team Lead

1. **(TeacherDashboard submissions counter)** — The counter in TeacherDashboard is hardcoded to `0` (D006 stub, documented). Now that `submissionService` is available, should D008 update TeacherDashboard to show real submission counts? It's a 3-line change; documenting here so it can be folded into D008 if desired.

2. **(Answer display on SubmissionsPage)** — Currently SubmissionsPage shows only the answer count per submission ("N answers"). Displaying the actual question text + student answer would require a join on the exam's questions array. This is M2 grading-UI territory; the M1 spec only requires "display in M1." Current implementation is compliant.

3. **(Draft key cleanup)** — Draft keys (`ems_draft_${examId}_${studentId}`) are cleared on successful submit but NOT on exam closure or deletion. For M1 this is harmless (stale keys do no harm; `StorageService.clear()` removes all `ems_*` keys if needed). M2 should consider TTL-based cleanup.
