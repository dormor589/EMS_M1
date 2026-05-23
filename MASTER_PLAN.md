# EMS_M1 — Master Plan

**Deployment:** EMS_M1 (Full Stack Exam Management System — Milestone 1)
**Spec source:** `docs/spec_brief.txt` (mirror of user-supplied DOCX brief)
**GitHub:** https://github.com/dormor589/EMS_M1
**Working branch:** `dev` (after D000 bootstrap)
**Date drafted:** 2026-05-23

---

## Project summary

Foundation + MVP for a Full Stack web app managing online exams and submissions.
M1 deliverable = React/Vite client with role-based Teacher/Student flows,
OOP service layer, mock persistence via `localStorage`, an Express skeleton
(placeholder only), documentation, diagrams, and modular Git commits on `dev`.

NOT in scope for M1: real auth (JWT/bcrypt), Postgres, real grading workflow,
WebSockets, AI grading, CI/CD, cloud deploy, advanced analytics, microservices.

Acceptance gate = brief §12 (12 criteria) + brief §16 (13-step Manual QA Checklist).
Both must pass at the end of the final D-task before user-approved `dev → main` PR.

---

## Risk classes

- **CRITICAL** — touches role-based gating (auth, navigation, status filters). A bug here breaks the entire demo.
- **HIGH** — touches the service layer (everything depends on services).
- **MEDIUM** — single page or single component group.
- **LOW** — docs, diagrams, README, cosmetic polish.

---

## Tier classes (per core §6.3, adapted in SENIOR_DEPLOY.overlay.md)

- **Tier 1** — <20 LOC, docs/cosmetics only. No QA dispatch.
- **Tier 2** — <100 LOC, single service/page/component group.
- **Tier 3** — multi-vertical change OR touches Auth/role gating.

---

## D-task breakdown

Sequential pipeline. Each D-task = one Implementer dispatch + one QA dispatch
(Tier 2 / Tier 3). Tier 1 = no QA. After every D-task PASS, the changes are
pushed to `dev`. The final D-task triggers the user-gated `dev → main` PR.

| # | Title | Tier | Risk | Depends | Est. time | User gate |
|---|---|---|---|---|---|---|
| **D001** | Project scaffold + dev branch + decision log | T3 | HIGH | — | 1h | — |
| **D002** | OOP service layer: Config + Logger + Storage + Notify | T3 | HIGH | D001 | 2h | — |
| **D003** | OOP service layer: MockApi + seed data + entity models | T3 | HIGH | D002 | 2h | — |
| **D004** | AuthService + Login/Register pages + role state | T3 | CRITICAL | D003 | 2h | — |
| **D005** | Role-based MainLayout + NavigationMenu + route guards | T3 | CRITICAL | D004 | 1.5h | — |
| **D006** | ExamService + Teacher pages: Dashboard, ExamList, Create, Edit, Submissions | T3 | HIGH | D005 | 3h | — |
| **D007** | SubmissionService + Student pages: Dashboard, AvailableExams, TakeExam, Grades | T3 | HIGH | D006 | 3h | — |
| **D008** | docs/explanation.txt + ai-work-log.txt + diagrams (component hierarchy, class, use case, entities) | T2 | LOW | D007 | 1.5h | — |
| **D009** | Manual QA checklist execution + polish + final acceptance walkthrough | T3 | CRITICAL | D008 | 1h | **YES** (dev → main PR) |

**Total estimate:** ~17h of worker time (excluding QA, which roughly doubles wall time per task).

---

## Per-D-task scope detail

### D001 — Project scaffold + dev branch + decision log
**What:** Initialize Vite+React app in `client/`; Express skeleton in `server/`;
README; placeholder folders per brief §6; **decision recorded**: JS or TS
(default JS unless Implementer flags a strong reason); switch git to `dev`
branch and set upstream. Commit conventional-message style.

**Acceptance:** `cd client && npm install && npm run dev` boots the app
without errors and shows a placeholder page. `git branch --show-current`
returns `dev`. Server `npm install && node src/app.js` boots and serves
`GET /health → 200 OK`.

**Out of scope:** any pages, services, business logic.

### D002 — Core services 1/2
**What:** Implement `ConfigService`, `LoggerService`, `StorageService`,
`NotifyService` as OOP classes per brief §8. Vitest tests for each.

**Acceptance:** All 4 services importable; each has ≥3 unit tests passing.
`LoggerService` does NOT use raw `console.log`. `StorageService` is the
only file that touches `localStorage`.

### D003 — Core services 2/2 + models
**What:** Implement `MockApiService` + `data/seedData.js`. Build entity classes
under `models/` (User, Exam, Question, Submission, Answer) per brief §7.
`MockApiService.seedIfEmpty()` populates localStorage with demo data on first run.

**Acceptance:** Re-running the app twice produces stable seed; data survives
refresh. Tests verify CRUD via MockApi.

### D004 — Auth flow
**What:** `AuthService` with `login/register/logout/getCurrentUser/isTeacher/isStudent`.
Login and Register pages. Role assignment at register. Current user in localStorage
via StorageService.

**Acceptance:** Register a teacher → user persists across refresh; login as that
user; `AuthService.isTeacher()` returns true. CRITICAL test: invalid creds rejected.

### D005 — Layout & role-based nav
**What:** `MainLayout` + `NavigationMenu` that changes per role.
`AppRoutes` with route guards: unauthenticated → Login; wrong role → redirect.

**Acceptance:** Teacher sees teacher links; Student sees student links; logged out
sees only Login/Register. Tested manually + with one component test.

### D006 — Teacher flow + ExamService
**What:** `ExamService` (CRUD + publish/close). Pages: TeacherDashboard,
TeacherExamsPage, CreateExamPage (title/description/duration/questions —
MC + open text), EditExamPage, SubmissionsPage (placeholder list).
Exam state machine `Draft → Published → Closed` enforced in service, not UI.

**Acceptance:** Teacher can create exam with ≥2 questions, edit it, publish it.
Status transitions blocked from invalid states. Published exams persist.

### D007 — Student flow + SubmissionService
**What:** `SubmissionService` (submit, getByExam, getByStudent). Pages:
StudentDashboard, AvailableExamsPage (only Published), TakeExamPage (renders
questions, collects answers, auto-save via localStorage optional), GradesPage.
SubmissionsPage on the teacher side now wired to actually show submissions
for the teacher's exams.

**Acceptance:** Student can see only Published exams; opens one, submits answers;
submission persists across refresh; teacher sees the submission. Student can NOT
see Draft or Closed exams.

### D008 — Docs + diagrams
**What:** Write `docs/explanation.txt` (plain text, per brief §14 template).
Diagrams under `docs/diagrams/`:
- `component-hierarchy.txt` (brief §15.1)
- `use-case-diagram.puml` (brief §15.2)
- `class-diagram.puml` (brief §15.3)
- `entities.txt` (brief §7 table)
Also `docs/ai-work-log.txt` summarizing per-D-task work performed.

**Acceptance:** All four diagram files present. `explanation.txt` covers
features, users, pages, services, limitations.

### D009 — Final manual QA + dev → main PR (USER GATE)
**What:** Execute the brief §16 13-step Manual QA Checklist end-to-end with
screenshots (or recorded steps). Fix any polish issues found. Final
`docs/ai-work-log.txt` summary entry.

**Acceptance:** All 13 §16 checklist items PASS. All 12 §12 acceptance criteria
satisfied. **HALT for user approval before opening `dev → main` PR.**

---

## User-approval gates

1. **Now — MASTER_PLAN approval.** This document. No work begins until user OKs.
2. **End of D009 — Open `dev → main` pull request.** Team Lead halts; user
   reviews the milestone, then authorizes the PR.
3. **Any deviation from brief §5.1 Must-Have list** — Team Lead halts and asks
   before incorporating Nice-to-Have items from §5.2.

---

## Concurrency / dispatch strategy

Pipeline is intentionally sequential — D-tasks depend on each other. Default
mode: **`fg` (foreground)** for every dispatch until D007. After D007 PASS, we
can dispatch `/qa D008` in `bg` while drafting D009 spec — small parallelism
opportunity. No multi-task background fan-out otherwise.

Monitor on `findings.jsonl` will be armed when the first `bg` dispatch happens
(per core §4.4a) — not before.

---

## Risks / known unknowns

1. **Vite + React boot speed on this machine** — unknown until D001 runs. If
   `npm install` is slow, Implementer logs the wall time but proceeds.
2. **JS vs TS choice at D001** — Implementer picks; rationale recorded. Once chosen,
   the entire deployment commits to that choice (no mid-flight switch).
3. **localStorage quota** — M1 mock data is small (~KBs); not a real risk but
   worth noting if seed grows.
4. **Brief ambiguity around "ai-work-log.txt"** — I'm treating it as a per-D-task
   running log Implementer appends to. If the user intends something different,
   easy fix in D008.

---

## What is NOT in this plan

- Real backend logic (only an Express skeleton with `/health`).
- Real authentication (mock only — passwords stored as-is in localStorage for M1).
- Database, Postgres, JWT, bcrypt — Milestone 2+.
- CI/CD, Docker, deployment — Milestone 2+.
- WebSockets, AI grading, analytics, microservices — Milestone 3+.

---

## Status

- [x] Deployment folder created and configured.
- [x] Inner git repo initialized; public GitHub remote at https://github.com/dormor589/EMS_M1.
- [x] Outer `.gitignore` updated with `deployments/EMS_M1/`.
- [x] Overlay files authored (CLAUDE / SENIOR_DEPLOY / IMPLEMENTER / QA).
- [x] Implementer and QA worker sessions initialized.
- [x] MASTER_PLAN.md drafted (this file).
- [ ] **AWAITING USER APPROVAL OF MASTER_PLAN.** No D-task will dispatch until approval.
