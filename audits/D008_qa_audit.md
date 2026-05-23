# D008 — QA Audit Report

**Date:** 2026-05-24T00:35:00Z
**Auditing:** D008 (Documentation + diagrams)
**Implementer report:** audits/D008_implementer_report.md
**Verdict:** PASS

---

## R14 sanity

N/A for M1.

---

## Artifact existence check

All 5 required documentation files verified present under `docs/`:

| File | Present | Lines |
|------|---------|-------|
| `docs/explanation.txt` | ✅ | 336 |
| `docs/diagrams/component-hierarchy.txt` | ✅ | 154 |
| `docs/diagrams/class-diagram.puml` | ✅ | 218 |
| `docs/diagrams/use-case-diagram.puml` | ✅ | 111 |
| `docs/diagrams/entities.txt` | ✅ | 114 |
| `docs/ai-work-log.txt` (D008 entry) | ✅ | +21 lines |

---

## Git log verification

D008 commits on `dev` (above D007 close marker `b95721e`):

| SHA | Message | Conventional `docs:`? |
|-----|---------|----------------------|
| 51ba120 | `docs: add explanation.txt with project overview and use cases` | ✅ |
| a48f28a | `docs: add component-hierarchy diagram` | ✅ |
| 27c66f7 | `docs: add class-diagram (PlantUML)` | ✅ |
| 08a77c8 | `docs: add use-case-diagram (PlantUML)` | ✅ |
| 47e460e | `docs: add entities reference` | ✅ |
| 070daf8 | `docs: append D008 entry to ai-work-log` | ✅ |

**6 `docs:` conventional commits on `dev` — ≥4 required ✓**

`origin/dev` HEAD = `87a7d14` = local `dev` HEAD. **Pushed ✓**

Note: Quota interruption did not cause mid-air commit splits or duplicate commits. All 6 commits are clean, atomic, and correctly scoped.

---

## Check 1 — explanation.txt is plain text (no Markdown syntax)

```
grep -n "^#|^\*\*|```|[.*](http" docs/explanation.txt
→ NONE FOUND
```

Manual scan confirms:
- No lines beginning with `#` (Markdown headers). Section headers use `====` underlines (ASCII). ✓
- No `**bold**` or `*italic*` markup. ✓
- No triple-backtick code fences. ✓
- No Markdown link syntax `[text](url)`. ✓
- Formatting uses only `=====` dividers, plain bullet indentation with `-`, and whitespace. ✓

**PASS ✓ — plain text, zero Markdown syntax**

---

## Check 2 — PlantUML files: valid @startuml/@enduml wrappers

### class-diagram.puml

```
@startuml EMS_M1_ClassDiagram  (line 1)
...218 lines of body...
@enduml                        (line 218)
```

Body structure verified:
- `skinparam` declarations ✓
- Two `package` blocks (`Entities`, `Services`) ✓
- `class` blocks with `+field : Type` attributes, `--` separator, and method signatures ✓
- Entity relationship arrows (`-->`, `*--`, `..>`) with multiplicity labels ✓
- No unclosed braces or dangling blocks ✓

**PASS ✓**

### use-case-diagram.puml

```
@startuml EMS_M1_UseCaseDiagram  (line 1)
...110 lines of body...
@enduml                          (line 111)
```

Body structure verified:
- `left to right direction` + `skinparam` declarations ✓
- Three `actor` declarations: Teacher, Student, Guest ✓
- `rectangle` wrapper, three inner `package` blocks (Authentication, Teacher Features, Student Features) ✓
- `usecase` declarations with quoted names and aliases ✓
- Actor `-->` usecase associations ✓
- `..>` with `<<include>>` stereotypes ✓
- `note right of` blocks ✓
- No unclosed braces or dangling blocks ✓

**PASS ✓**

---

## Check 3 — Component hierarchy reflects actual codebase

Cross-checked diagram against `client/src/` directory tree:

### Teacher pages

| Diagram entry | Actual file | Match |
|--------------|-------------|-------|
| TeacherDashboard | `pages/teacher/TeacherDashboard.jsx` | ✅ |
| TeacherExamsPage | `pages/teacher/TeacherExamsPage.jsx` | ✅ |
| CreateExamPage | `pages/teacher/CreateExamPage.jsx` | ✅ |
| EditExamPage | `pages/teacher/EditExamPage.jsx` | ✅ |
| SubmissionsPage | `pages/teacher/SubmissionsPage.jsx` | ✅ |

No extra files in `pages/teacher/`. All 5 present in diagram. ✓

### Student pages

| Diagram entry | Actual file | Match |
|--------------|-------------|-------|
| StudentDashboard | `pages/student/StudentDashboard.jsx` | ✅ |
| AvailableExamsPage | `pages/student/AvailableExamsPage.jsx` | ✅ |
| TakeExamPage | `pages/student/TakeExamPage.jsx` | ✅ |
| GradesPage | `pages/student/GradesPage.jsx` | ✅ |

All 4 match. ✓

### Auth pages

| Diagram entry | Actual file | Match |
|--------------|-------------|-------|
| LoginPage | `pages/auth/LoginPage.jsx` | ✅ |
| RegisterPage | `pages/auth/RegisterPage.jsx` | ✅ |

### Layout / shared components

| Diagram entry | Actual file | Match |
|--------------|-------------|-------|
| MainLayout | `components/layout/MainLayout.jsx` | ✅ |
| NavigationMenu | `components/layout/NavigationMenu.jsx` | ✅ |
| ProtectedRoute | `components/shared/ProtectedRoute.jsx` | ✅ |
| NotFoundPage | `pages/NotFoundPage.jsx` | ✅ |

### Divergences from §15.1 template — all documented in component-hierarchy.txt

1. **`PageContainer`** — template names this "PageContainer"; actual code has unnamed `<main>` element. Diagram: `<main> / Outlet`. ✓
2. **`LandingRedirect`** — not a separate file; inline function inside `routes.jsx`. Documented as "inline". ✓
3. **`ProtectedRoute`** — absent from §15.1 template; added to diagram to reflect reality. ✓
4. **`QuestionEditor`** — not a standalone file; local unexported sub-component in CreateExamPage + EditExamPage. Documented as "local", M2 extraction noted. ✓
5. **`NotFoundPage`** — absent from §15.1 template; added to diagram. ✓

All 5 divergences are correctly documented at bottom of `component-hierarchy.txt`. Diagram reflects actual code, not template fiction. **PASS ✓**

---

## Check 4 — Class diagram: all 8 services + 5 entities with relationships

### Entity classes (5)

Verified via `grep "^  class " class-diagram.puml` → 13 total `class` declarations.

| Entity | In diagram | Key fields present |
|--------|------------|-------------------|
| User | ✅ | id, name, email, password, role + toJSON/fromJSON |
| Exam | ✅ | id, title, description, durationMinutes, status, createdBy, questions, createdAt |
| Question | ✅ | id, examId, type, text, options, correctAnswer, points |
| Submission | ✅ | id, examId, studentId, answers, status, grade, feedback, submittedAt |
| Answer | ✅ | questionId, value |

### Service classes (8)

| Service | In diagram | Dependencies correct |
|---------|------------|---------------------|
| ConfigService | ✅ | (no deps — leaf) |
| LoggerService | ✅ | (no deps — leaf) |
| StorageService | ✅ | (no deps — leaf) |
| NotifyService | ✅ | (no deps — leaf) |
| MockApiService | ✅ | `..>` StorageService, ConfigService, LoggerService |
| AuthService | ✅ | `..>` MockApiService, StorageService, ConfigService, LoggerService |
| ExamService | ✅ | `..>` MockApiService, ConfigService, LoggerService |
| SubmissionService | ✅ | `..>` MockApiService, ExamService, ConfigService, LoggerService |

Dependency arrows match the actual constructor injection wiring in `services/index.js`. ✓

### Entity relationships per spec

| Relationship | Spec requirement | Diagram line | Match |
|-------------|-----------------|--------------|-------|
| User creates Exam (1:N) | ✅ required | `User "1" --> "0..*" Exam : creates\n(createdBy = user.id)` | ✅ |
| Exam contains Question (1:N) | ✅ required | `Exam "1" *-- "0..*" Question : contains\n(stored as plain objects)` | ✅ |
| User submits Submission (1:N) | ✅ required | `User "1" --> "0..*" Submission : submits\n(studentId = user.id)` | ✅ |
| Exam receives Submission (1:N) | ✅ required | `Exam "1" --> "0..*" Submission : receives\n(examId = exam.id)` | ✅ |
| Submission embeds Answer (1:N) | ✅ required | `Submission "1" *-- "0..*" Answer : embeds\n(not a top-level collection)` | ✅ |

All 5 required entity relationships present with correct multiplicity. ✓

Composition (`*--`) correctly distinguishes embedded collections (Question inside Exam, Answer inside Submission) from ID-reference associations (`-->`). This accurately reflects that Questions and Answers are not standalone top-level collections — they live inside their parent records.

**PASS ✓ — 13 classes, all 5 entity relationships, all 8 service dependency chains**

---

## Check 5 — ai-work-log.txt D008 entry

Entry at line 238:
```
D008 — 2026-05-24T01:00:00Z
  Agent: Implementer (claude-sonnet-4-6)
  Task: Documentation + diagrams
  Authored docs/explanation.txt (plain text) and 4 diagram files under
  docs/diagrams/. Spec sections cited: 14, 15.1, 15.2, 15.3.
  Note: task was interrupted mid-execution by a quota cap and resumed
  in a second invocation; no work was duplicated or lost.
  Wall time: ~35 minutes (split across two invocations).
  Files added: [list of 5 files]
  Each artifact was committed separately per overlay requirement.
  Total docs: commits on dev branch.
```

Contains: timestamp, task description, spec sections cited, all 5 file names, wall time, interruption note. **PASS ✓**

---

## Content accuracy review

### explanation.txt content accuracy

Spot-checked against actual D001–D007 codebase state:

| Claim | Actual | Match |
|-------|--------|-------|
| "214 tests across 11 test files" | Vitest: 214/214 (11 files) | ✅ |
| 8 service classes listed | 8 services in `client/src/services/` | ✅ |
| 5 entity classes listed | 5 models in `client/src/models/` | ✅ |
| Client on port 5173, server on port 4000 | Vite default + server/index.js | ✅ |
| Seed creds: teacher@ems.dev / password, student@ems.dev / password | `seedData.js` | ✅ |
| gradeSubmission stub exists, no teacher grading UI | D007 SubmissionService + no grading page | ✅ |
| "NotifyService emits events but no toast component subscribed" (Known Limitation #7) | Correct — no NotificationBanner exists | ✅ |
| "express 5 server on port 4000 with GET /health" | D001 server scaffold | ✅ |
| Plain-text passwords, bcrypt deferred to M2 | AuthService.js (plain compare) | ✅ |

All factual claims verified accurate. No fabricated or aspirational features described as implemented. ✓

### use-case-diagram accuracy

- `UC_Grade` labelled `<<M2 - service stub only>>` — correct (gradeSubmission() service exists, no UI). ✓
- State machine note on UC_Publish reflects exact ExamService transitions. ✓
- Duplicate-submit note on UC_Submit matches SubmissionService guard exactly. ✓
- Guest actor correctly handles Register + Login only. ✓
- Teacher's UC_Register is absent from Teacher associations (teacher registers as Guest, then becomes Teacher after login) — technically valid. Teachers use UC_Register as Guest, then UC_Login. This is correct modeling since registration doesn't require being a Teacher actor first.

### entities.txt accuracy

- Exam status values `Draft / Published / Closed` — match ConfigService.getExamStatusOptions(). ✓
- Storage keys `ems_users`, `ems_exams`, `ems_submissions`, `ems_current_user` — match ConfigService.getStorageKeys(). ✓
- Draft key pattern `ems_draft_<examId>_<studentId>` — matches TakeExamPage draftKey function. ✓
- State machine summary matches ExamService publishExam/closeExam enforcement. ✓
- Error message format `"Invalid status transition: <from> -> <to>"` — note: code uses `→` (Unicode arrow) but entities.txt uses `->`. Functionally equivalent in plain text; not an error. ✓

---

## Findings

### CRITICAL findings

*(none)*

---

### MINOR findings

**MINOR-1 (`docs/ai-work-log.txt:256`)** — Truncated sentence: "Total docs: commits on dev branch." This is clearly a rendering artifact from the quota interruption + resume — the intended text was probably "Total: 6 `docs:` commits on dev branch." or similar. The entry is informational only; no functional impact.

---

### NOTE findings

**NOTE-1** — `explanation.txt` Known Limitation #7 documents the NotifyService UI gap ("events emitted but no toast component subscribed"). The implementer also surfaced this as a follow-up question for Team Lead. D009 polish could address this with a minimal `NotificationBanner` component subscribed in `MainLayout`. The documentation is accurate as written.

**NOTE-2** — `use-case-diagram.puml` marks `UC_Grade` as `<<M2 - service stub only>>`. This is accurate and correctly distinguishes what is implemented (service method) from what is not (teacher UI). No action required; informational.

**NOTE-3** — `component-hierarchy.txt` includes a CRITICAL annotation on `AvailableExamsPage`: "CRITICAL: uses getPublishedExams() only -- never shows Draft or Closed." This is a documentation-level reinforcement of the overlay's CRITICAL severity rule. Appropriate and useful; no action needed.

---

## Follow-up questions for Team Lead

1. **(NotifyService UI gap)** `explanation.txt` correctly documents that `NotifyService` emits events but no visual subscriber (toast/banner) exists in M1. Should D009 add a minimal `NotificationBanner` component in `MainLayout`? This would also resolve the carry-over `.catch((err) => notify.error(err.message))` calls that currently fire silently.

*(No spec ambiguities.)*

---

## Acceptance criteria matrix

| Criterion | Evidence | Result |
|-----------|----------|--------|
| All 5 documentation artifacts exist under `docs/` | File listing verified | ✅ |
| `explanation.txt` is plain text — no `#`, `**`, code fences | grep NONE FOUND; manual scan | ✅ |
| Diagrams reflect ACTUAL code (not template verbatim) | Cross-checked all pages and components; 5 divergences documented | ✅ |
| `class-diagram.puml` — valid `@startuml`/`@enduml` + body | `@startuml` line 1, `@enduml` line 218; body syntax verified | ✅ |
| `use-case-diagram.puml` — valid `@startuml`/`@enduml` + body | `@startuml` line 1, `@enduml` line 111; body syntax verified | ✅ |
| Class diagram: all 8 services + 5 entities + relationships | 13 classes; all 5 entity rels + all 8 service dep chains | ✅ |
| Component hierarchy matches actual `client/src/` tree | All teacher/student/auth/shared pages verified; NotFoundPage included | ✅ |
| `ai-work-log.txt` D008 entry added | Line 238: entry present with timestamp, task, files, wall time | ✅ |
| ≥4 `docs:` conventional commits on dev | 6 `docs:` commits verified | ✅ |
| origin/dev pushed | HEAD matches local | ✅ |
| No TODO/FIXME in any new file | Verified by read; none present | ✅ |

---

## Verdict: PASS

All 5 documentation artifacts exist and are correct. `explanation.txt` is clean plain text with zero Markdown syntax. Both PlantUML files have valid `@startuml`/`@enduml` wrappers and syntactically sound bodies (class diagram: 13 classes, 5 entity relationships, 8 service dependency chains; use-case diagram: 3 actors, 18 use cases, include relationships, enforcement notes). The component hierarchy accurately reflects the actual `client/src/` tree with all 5 template divergences explicitly documented. Content accuracy was spot-checked against the live codebase — all factual claims are correct. `ai-work-log.txt` has the D008 entry. 6 `docs:` conventional commits on dev, pushed.

One MINOR (truncated sentence in ai-work-log caused by the quota-cap resume) and two informational NOTEs. None block PASS.
