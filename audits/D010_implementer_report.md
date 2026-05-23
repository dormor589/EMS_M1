# D010 — Implementer Report

**Date:** 2026-05-24T02:15:00Z
**Status:** Submitted for QA review

---

## What was built

| File | Lines | Notes |
|------|-------|-------|
| `client/src/pages/teacher/SubmissionDetailPage.jsx` | 256 | New page — answers review + grading form |
| `client/src/services/SubmissionService.js` | +25 | Added `getSubmissionById(id)` |
| `client/src/services/AuthService.js` | +19 | Added `getUserById(id)` |
| `client/src/pages/teacher/SubmissionsPage.jsx` | +13 | Grade column + Grade/Review link per row |
| `client/src/app/routes.jsx` | +5 | `/teacher/submissions/:id` route |
| `client/src/styles/pages.css` | +30 | `ems-detail-grid`, `ems-form__banner--error` |
| `client/src/services/__tests__/SubmissionService.test.js` | +44 | 4 new `getSubmissionById` tests |
| `client/src/services/__tests__/AuthService.test.js` | +23 | 3 new `getUserById` tests |

---

## Automated checks

| Check | Result |
|-------|--------|
| `npm run build` | ✅ 55 modules, 113ms, 0 warnings |
| `npx vitest run` | ✅ 221/221 tests pass, 11 test files |

---

## Acceptance criteria verification

| Criterion | Result |
|-----------|--------|
| Teacher clicks submission row → lands on `/teacher/submissions/:id` with student name, exam title, timestamp, all questions + answers | ✅ — SubmissionsPage has `<Link to="/teacher/submissions/${s.id}">` per row; SubmissionDetailPage renders header (exam, student name+email, submittedAt, grade) + per-question answers |
| Grade form accepts 0–100 + optional feedback; "Save grade" persists via existing service | ✅ — `<input type="number" min="0" max="100" required>` + JS guard `if (numGrade < 0 || numGrade > 100)`; calls `submissionService.gradeSubmission()` |
| After saving, the detail page shows the new grade | ✅ — `handleSaveGrade` calls `loadData()` on success to re-fetch; header "Current grade" updates |
| Student GradesPage shows grade + feedback | ✅ — GradesPage already renders `s.grade` as `<strong>` and `s.feedback` as text (built D007); no changes needed |
| Editing a previously-graded submission pre-fills the form | ✅ — `loadData()` sets `setGrade(String(sub.grade))` and `setFeedback(sub.feedback)` when `sub.grade !== null` |
| `npx vitest run` 100% pass | ✅ 221/221 |
| `npm run build` succeeds with no new warnings | ✅ |
| ≥4 conventional commits on `dev`, pushed | ✅ — 6 commits (see below) |

---

## New service methods

### `SubmissionService.getSubmissionById(id)`

Thin wrapper around `mockApi.getById('submissions', id)`. Returns the submission plain-object or `null`. Throws if `id` is missing. Added so `SubmissionDetailPage` depends only on `SubmissionService`, not on `mockApi` directly (no business logic in JSX).

### `AuthService.getUserById(id)`

Thin wrapper around `mockApi.getById('users', id)`. Returns the user plain-object or `null`. Throws if `id` is missing. Used by `SubmissionDetailPage` to display the submitting student's name and email.

---

## SubmissionDetailPage — design notes

- **Data loading:** `useCallback` + `useEffect` pattern (same as other pages). `Promise.all` for concurrent exam + student fetch after the submission is loaded. One extra serial step (`getSubmissionById`) before the parallel pair — unavoidable since examId/studentId aren't known until the submission is loaded.
- **Failure modes:**
  - Submission not found → `ems-form__banner--error` + back link (no crash).
  - Exam deleted (null) → graceful "Exam no longer available" note in header; question list shows "Exam data unavailable" message.
  - Student deleted (null) → falls back to showing raw `studentId` in monospace.
  - Grade out of range → JS validation rejects before service call; `setFormErr` shown inline.
- **Pre-fill on re-grade:** `loadData()` checks `sub.grade !== null` and calls `setGrade` / `setFeedback`, so the form pre-fills on page load for already-graded submissions.
- **Grade/Review label:** SubmissionsPage row button shows "Grade" when `status === 'submitted'` and "Review" when `status === 'graded'` — reflects actual state to the teacher.

---

## GradesPage sanity check (AC 4)

`GradesPage.jsx` built in D007 already renders:
```jsx
{s.grade !== null && s.grade !== undefined
  ? <strong>{s.grade}</strong>
  : <span>Not yet graded</span>}
...
{s.feedback || '—'}
```
This correctly handles a non-null numeric grade and non-empty feedback string. **No changes needed.**

---

## NavigationMenu check (AC 5)

The "Submissions" link in `TeacherLinks` is `<NavLink to="/teacher/submissions">`. The new route `/teacher/submissions/:id` is a child path that doesn't conflict. **No changes needed.**

---

## Self-review checklist

- [x] All tests pass (221/221) ✅
- [x] `npm run build` clean (0 warnings) ✅
- [x] `getSubmissionById` — missing id throws, not-found returns null, found returns record ✅
- [x] `getUserById` — missing id throws, not-found returns null, found returns record ✅
- [x] SubmissionDetailPage — no business logic in JSX (all in services) ✅
- [x] No localStorage outside StorageService ✅
- [x] No console.* outside LoggerService ✅
- [x] Grading form validates 0–100 before calling service ✅
- [x] Pre-fill works on revisit of graded submission ✅
- [x] Failure modes handled (not-found, deleted exam) ✅
- [x] GradesPage already shows grade+feedback correctly (verified, no change) ✅
- [x] No TODO/FIXME ✅
- [x] 6 commits, all on `dev` ✅

---

## Commits produced on `dev`

| SHA | Message |
|-----|---------|
| c3f4d19 | `feat: add getSubmissionById to SubmissionService and getUserById to AuthService` |
| 953a5a5 | `feat: add SubmissionDetailPage with student answers and grading form` |
| e84cebd | `feat: wire SubmissionsPage row links and Grade/Review action column` |
| 14b02bb | `chore: add /teacher/submissions/:id route (SubmissionDetailPage)` |
| 6aae07d | `test: add tests for getSubmissionById and getUserById (D010 grading flow)` |
| 223203e | `docs: append D010 entry to ai-work-log` |

---

## Follow-up questions for Team Lead

1. **(Student name display)** — `SubmissionDetailPage` shows the student's `name` + `email` from the user record. If a student was deleted from the mock DB while their submission persists, the page falls back to showing the raw `studentId` UUID — this is intentional and graceful. No action needed.

2. **(Out-of-scope confirmation)** — Per-question grading, AI grading, bulk actions, and grade-release workflow were deliberately excluded per D010 "Out of scope" section. All deferred to M2.
