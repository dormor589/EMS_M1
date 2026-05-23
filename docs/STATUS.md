# EMS_M1 — Milestone 1 Final Status

**Date closed:** 2026-05-24
**Status:** ✅ Milestone 1 COMPLETE — submitted on `dev` branch (no PR to `main` per course rules).
**Repo:** https://github.com/dormor589/EMS_M1
**Working branch:** `dev` (120 commits, in sync with `origin/dev`).
**`main` branch:** untouched (still at initial bootstrap `11fe547`).

---

## Completed D-tasks

| # | Title | Verdict | Notes |
|---|---|---|---|
| D001 | Project scaffold + dev branch + JS/TS decision | PASS | 2 MINOR (waived — cosmetic README + commit-message) |
| D002 | Services 1/2: Config, Logger, Storage, Notify | PASS | 2 MINOR (waived — pattern carry-over) |
| D003 | Services 2/2: MockApi + seed + 5 entity models | PASS | 3 MINOR (waived) |
| D004 | AuthService + Login/Register + role state | PASS | 3 MINOR (waived) |
| D005 | Role-based MainLayout + NavigationMenu + route guards | PASS | clean |
| D006 | ExamService + Teacher flow | PASS | clean |
| D007 | SubmissionService + Student flow | PASS | clean |
| D008 | Documentation + 4 diagrams | PASS | resumed after quota cap |
| D009 | Final manual QA walkthrough + polish | PASS | 13/13 §16 + 12/12 §12 |
| D010 | Minimal teacher review + grading UI | PASS | user-approved scope addition |
| D011 | Polish: fix D010 MINORs (Tier 1) | PASS | TL diff-review, no QA |
| D012 | Generate PNG renders of PlantUML diagrams (Tier 1) | PASS | TL diff-review, no QA |

---

## Final delivery metrics

| Metric | Value |
|---|---|
| Total commits on `dev` | 120 |
| `feat:` commits | 30 |
| `docs:` commits | 35 |
| `test:` commits | 7 |
| `fix:` commits | 1 |
| `style:` commits | 2 |
| `chore:` commits | 44 (D-task closeouts, scaffold, indexes) |
| Test suite | 221 / 221 PASS (Vitest) |
| Build | `npm run build` clean, 0 warnings |
| Files in `docs/diagrams/` | 6 (4 sources + 2 PNGs) |

---

## §16 Manual QA Checklist — final result

All 13 steps PASS (verified independently by QA in D009 and re-verified after D010 grading addition).

## §12 Acceptance Criteria — final result

All 12 criteria PASS.

---

## What was built (features visible to the user)

1. **Authentication:** Mock register + login + logout. Two roles (teacher, student). Seeded demo users (`teacher@ems.dev` / `student@ems.dev`, password `password`).
2. **Role-based navigation:** Different nav menus per role. Route guards redirect unauthorized access.
3. **Teacher flow:**
   - Dashboard with exam counters.
   - Create exam (title, description, duration, MC + open-text questions).
   - Edit exam.
   - Publish / Close (state machine enforced in service: Draft → Published → Closed).
   - Submissions list per exam.
   - **Submission detail view** with student's per-question answers + grading form (0–100 + optional feedback).
4. **Student flow:**
   - Dashboard with counters.
   - Available exams (only Published, hides already-submitted).
   - Take exam (MC radio + open-text textarea, optional draft auto-save).
   - Grades page showing submitted exams + grades + feedback.
5. **Mock persistence:** All data in `localStorage`, survives refresh. Single seed call on first boot.
6. **Express skeleton:** `server/src/app.js` with `/health` endpoint. No real backend.

---

## What was NOT built (deferred to M2+)

Per brief §5.3 + scoping decisions:
- Real JWT / bcrypt authentication.
- Postgres or any real database.
- Real grading workflow with rich-text editor / per-question grading / AI grading.
- WebSockets / real-time monitoring.
- CI/CD, Docker, cloud deployment.
- Notifications visible UI (NotifyService is in-memory only).
- Microservices.
- Advanced analytics dashboard.

---

## Known limitations

- Passwords stored as plain text in `localStorage` (mock auth — M1 scope).
- `localStorage` is per-browser; no multi-device sync.
- No reliability layer for `MockApiService.seedIfEmpty()` failure (silent — would only fire on quota exhaustion).
- Grading UI is intentionally minimal — one numeric grade per submission, no per-question grading.
- PlantUML PNGs are pre-rendered (`.png` committed); regenerating requires `brew install plantuml` locally.

---

## Carry-over notes for M2

When the project resumes for Milestone 2:
1. Re-read `MASTER_PLAN.md` and this STATUS.md for context.
2. Spawn a new Team Lead / Implementer / QA session pair (don't reuse the M1 sessions if too much time has passed).
3. The first M2 D-task should likely backfill the recurring MINORs that were waived (especially `App.jsx` seedIfEmpty `.catch()` and the hardcoded `EMS_KEY_PREFIX` / `VALID_COLLECTIONS` constants — see D003/D004 QA audits for details).
4. The next architectural step is real backend (Express routes + JWT or session auth + Postgres).

---

## Repository links

- Repo root: https://github.com/dormor589/EMS_M1
- Dev branch tree: https://github.com/dormor589/EMS_M1/tree/dev
- Commit history: https://github.com/dormor589/EMS_M1/commits/dev
- Diagrams (rendered PNGs): https://github.com/dormor589/EMS_M1/tree/dev/docs/diagrams

---

## Process honest assessment

- Implementer + QA sessions performed reliably; multi-commit-per-D-task discipline held throughout.
- Team Lead initially waived MINOR findings without explicit rationale across D001–D004; tightened up from D005 onward (zero MINORs found D005–D009).
- QA's value-add was mostly independent execution + spec-literal review; QA did not author original edge-case tests (a gap relative to its own brief).
- Quota cap hit mid-D008; resumed cleanly post-reset.
- D010 (grading UI) and D012 (PNG renders) were user-driven scope additions after demo review.

---

## Deployment state at close

- `dev` branch: clean, pushed, all artifacts present.
- Persistent Monitor: STOPPED (task `b3geq7anp`).
- No live worker processes.
- Worker session UUIDs preserved in `.implementer_session_id` and `.qa_session_id` for potential M2 reuse.
- Awaiting M2 trigger from user.
