# EMS_M1 — QA Overlay

Read this alongside `core/QA_AUDITOR_BRIEF.core.md`. Project-specific rules
that OVERRIDE conflicting core defaults for the EMS_M1 deployment.

## Spec source

Sole spec: `deployments/EMS_M1/docs/spec_brief.txt`.
There is no `research_findings/` and no `PRE_IMPLEMENTATION_HANDOFF.md`.
Cite the brief's section numbers when flagging spec-deviations.

## Stack

JS/React/Vite + Express skeleton. **NOT Python.** Ignore "Always use python3"
from core.

## Real-API discipline (core §3.9 / §3.10)

**N/A for M1.** No real exchange / external API exists in this deployment.
The mandatory "## Real-API Re-Validation (Independent)" section in your audit
is replaced by:

### `## Manual UX Re-Validation` (for any D-task that touches UI / flow)

You independently exercise the relevant user flow in a fresh `npm run dev`
session and document what you saw:
- Steps performed
- Pages/components touched
- Pass/fail per acceptance criterion

For service-only D-tasks (no UI), run the Implementer's tests yourself
(`vitest run`) and paste the output.

## R14 sanity reproduction

**N/A.** No numeric reproduction gate in M1.

## Acceptance criteria source

Use brief §12 (Acceptance Criteria for Milestone 1) and brief §16 (Manual QA
Checklist) as the master list. Your final D-task audit (for the QA D-task)
should walk through ALL 13 items of §16.

## Severity floor specific to M1

- **CRITICAL** (auto-REVISIONS): business logic in components when it should be in services; direct localStorage access outside StorageService; commits on `main` instead of `dev`; missing role-based nav gating; Student can see Draft/Closed exams; data does NOT persist across refresh; raw `console.log` in committed code.
- **MINOR**: missing JSDoc on a service method; magic number not in constants; styling inconsistency; missing edge-case test on a service.
- **NOTE**: refactor suggestions for M2; style preferences.

## Mocked-only is OK in M1

Core §3.9's rule "mocked-only test of a production-API boundary → CRITICAL"
does NOT apply in M1 because there IS no production boundary yet — the
entire system is intentionally mocked. Do NOT issue CRITICAL on M1 code for
"only uses mocks."

## Manual QA Checklist (brief §16)

Reproduce these 13 steps in a fresh browser session for any D-task that
delivers a milestone-acceptance-impacting feature:

1. App opens locally without errors.
2. Register a Teacher user.
3. Login as Teacher.
4. Create a new exam with ≥2 questions.
5. Publish the exam.
6. Logout.
7. Register / login as Student.
8. Published exam appears in Available Exams.
9. Open exam, submit answers.
10. Refresh — submission still saved.
11. Teacher can see the submission.
12. Navigation differs Teacher vs Student.
13. `docs/` and `docs/diagrams/` exist on `dev`.

Audit verdict for the final D-task requires ALL 13 to pass.

## Anti-patterns specific to EMS_M1 QA

1. Do NOT issue REVISIONS for "tests are mocks" — M1 is intentionally mocked.
2. Do NOT issue REVISIONS for "Express has no real endpoints" — skeleton is the M1 deliverable.
3. Do NOT issue REVISIONS for absent JWT/Postgres — those are explicitly out of scope.
4. Do NOT skip the Manual UX Re-Validation when D-task touches UI flow.
