# D008 — Implementer Report

**Date:** 2026-05-24T01:00:00Z
**Status:** Submitted for QA review

> **Note on execution:** This D-task was interrupted mid-run by an API quota
> cap after writing and committing `explanation.txt` and `component-hierarchy.txt`,
> and after writing (but not committing) `class-diagram.puml` and
> `use-case-diagram.puml`. A second invocation resumed from disk state, verified
> both uncommitted `.puml` files were valid, committed them, and completed the
> remaining artifacts. No work was duplicated or regenerated unnecessarily.

---

## What was built

| File | Lines | Notes |
|------|-------|-------|
| `docs/explanation.txt` | 336 | Plain text, no Markdown; uses `=====` ASCII headers |
| `docs/diagrams/component-hierarchy.txt` | 153 | Actual D001–D007 tree with divergence notes |
| `docs/diagrams/class-diagram.puml` | 218 | All 5 entities + all 8 services + relationships |
| `docs/diagrams/use-case-diagram.puml` | 111 | Teacher, Student, Guest actors; M2 stubs noted |
| `docs/diagrams/entities.txt` | 113 | ASCII table + field detail + state machine summary |
| `docs/ai-work-log.txt` | +21 lines | D008 entry appended |

---

## R14 sanity result

**N/A for M1.**

---

## Acceptance criteria verification

| Criterion | Result |
|-----------|--------|
| All 5 documentation artifacts exist under `docs/` | ✅ |
| `explanation.txt` is plain text — no `#`, `**`, or code fences | ✅ — uses `===` ASCII headers and plain dash lists only |
| Diagrams reflect ACTUAL code (not the brief template verbatim) | ✅ — divergences from §15.1 documented in component-hierarchy.txt |
| PlantUML files have valid `@startuml`/`@enduml` + body | ✅ — both verified by reading and visual inspection |
| `ai-work-log.txt` D008 entry added | ✅ |
| ≥4 `docs:` conventional commits on dev, pushed | ✅ — 6 commits (see table below) |

---

## Divergences from spec §15.1 template (documented in component-hierarchy.txt)

1. **PageContainer** — The template names this child of MainLayout "PageContainer". In the actual code it is the `<main className="ems-main">` element wrapping `<Outlet />`. No named component file exists. Diagram shows `<main> / Outlet` to reflect reality.

2. **LandingRedirect** — Not a separate file. It is an inline function component defined inside `routes.jsx`, used as the element for `path="/"`. Documented as such.

3. **ProtectedRoute** — Not mentioned in the §15.1 template. It is a real shared component at `components/shared/ProtectedRoute.jsx` that wraps every guarded route. Added to the hierarchy diagram.

4. **QuestionEditor** — Not a standalone file. Defined as a local unexported sub-component inside `CreateExamPage.jsx` (and duplicated in `EditExamPage.jsx`). Documented as local, with M2 extraction noted.

5. **NotFoundPage** — Not in the §15.1 template. Added to the diagram as the `path="*"` catch-all.

---

## Architecture of diagram content

### class-diagram.puml

Two `package` blocks — `Entities (client/src/models/)` and `Services (client/src/services/)`. Entity relationships use UML composition (`*--`) for embedded collections (Question inside Exam, Answer inside Submission) and association (`-->`) for ID-reference relationships. Service dependencies use dependency arrows (`..>`) labelled `uses`, reflecting constructor-injection wiring.

All 8 service classes include their actual private dependency fields and public method signatures with return types. All 5 entity classes include fields with types and `toJSON()` / `fromJSON()` methods.

### use-case-diagram.puml

Three actors: Teacher, Student, Guest (Unauthenticated). Uses `<<include>>` for composed sub-actions (AddMC/AddOT included by Create and Edit). Notes on `UC_Publish`, `UC_Submit`, and `UC_Grade` describe the actual enforcement rules (state machine, duplicate-submit guard, M2 stub). UC_Grade is labelled `<<M2 - service stub only>>` to accurately reflect that `gradeSubmission()` exists in the service but has no teacher UI in M1.

### explanation.txt

Follows the §14 template structure exactly. All sections populated from actual D001–D007 state: use cases match implemented pages, services match the 8 service files, entities match the 5 model files, How-to-Run gives real commands (`npm run dev` on port 5173, `npm start` on port 4000), Known Limitations lists 10 real M1 constraints including plain-text passwords, no JWT, no timer enforcement, no grading UI, and the silent `NotifyService` (events emitted but no toast component exists yet).

---

## Self-review checklist

- [x] `explanation.txt` — plain text only, no Markdown syntax ✅
- [x] `component-hierarchy.txt` — reflects actual file tree + documents all divergences ✅
- [x] `class-diagram.puml` — valid `@startuml`/`@enduml`, all 13 classes, correct relationships ✅
- [x] `use-case-diagram.puml` — valid `@startuml`/`@enduml`, all actors, M2 stubs noted ✅
- [x] `entities.txt` — ASCII table + field details + storage keys + state machine ✅
- [x] `ai-work-log.txt` — D008 entry appended with quota interruption note ✅
- [x] ≥4 `docs:` commits (6 produced) ✅
- [x] No TODO/FIXME in any file ✅
- [x] No Markdown syntax in `explanation.txt` ✅

---

## Commits produced on `dev`

| SHA | Message |
|-----|---------|
| 51ba120 | `docs: add explanation.txt with project overview and use cases` |
| a48f28a | `docs: add component-hierarchy diagram` |
| 27c66f7 | `docs: add class-diagram (PlantUML)` |
| 08a77c8 | `docs: add use-case-diagram (PlantUML)` |
| 47e460e | `docs: add entities reference` |
| 070daf8 | `docs: append D008 entry to ai-work-log` |

---

## Follow-up questions for Team Lead

1. **(NotifyService UI gap)** — `explanation.txt` Known Limitation #7 documents that `NotifyService` emits events but no toast/alert component is subscribed. D009 QA will surface this during the checklist walkthrough. A simple `NotificationBanner` component subscribed in `MainLayout` would resolve it and is a small addition — recommend adding in D009 polish if time allows, or deferring to M2.

2. **(TeacherDashboard submissions counter stub)** — The counter is hardcoded to `0` in `TeacherDashboard.jsx`. The `submissionService` singleton is now available. This is a 3-line fix. If D009 includes any polish pass it can be resolved there; otherwise M2.

3. **(PlantUML rendering)** — The `.puml` files are source-only as per D008 out-of-scope note. If the course requires rendered PNG/SVG, they can be generated from these sources using the PlantUML CLI (`plantuml docs/diagrams/*.puml`) or the PlantUML VS Code extension. No code changes needed.
