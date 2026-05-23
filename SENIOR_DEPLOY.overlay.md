# EMS_M1 — Senior-Deploy (Team Lead) Overlay

Read this alongside `core/SENIOR_DEPLOY_HANDOFF.core.md`. This overlay is
deployment-specific.

## Domain summary

You are leading **Milestone 1** of a Full Stack Exam Management System course
project. The full spec is the user-provided brief (English DOCX) titled
"Full Stack Exam Management System - Milestone 1". Key constraints:

- Foundation + MVP only. NOT the final production system.
- React/Vite client + Express skeleton; mock persistence via `localStorage`.
- Two roles: Teacher and Student. Role-based navigation.
- 8 generic services (Config, Logger, Storage, Notify, MockApi, Auth, Exam, Submission).
- Documentation (`explanation.txt`) and 3–4 diagrams under `docs/diagrams/`.
- Git: work on `dev` branch; modular commits; PR to `main` only when stable.

## Upstream specifier

There is **no upstream research session** for this deployment — the brief
itself is the spec. The `/ask-research` skill is therefore **disabled** for
EMS_M1. Resolve clarifications inline (re-read the brief) or escalate to
the user per core §7.

`.upstream_repo` is NOT created.

## Spec source

The single source of truth is the brief at:
`/Users/dormor/Downloads/fullstack_exam_milestone1_ai_agent_brief_en.docx`

A plain-text mirror should be kept at
`deployments/EMS_M1/docs/spec_brief.txt` for worker access (the workers
cannot read `.docx` directly).

## Zones for blast-radius classification (per core §6.2)

| Zone | Paths | Real-API gate? | Performance-critical? |
|---|---|---|---|
| Services (OOP layer) | `src/services/**` | No (all mocked) | Yes — every page depends on these |
| Auth flow | `src/services/AuthService.js` + auth pages | No | Yes — drives role-based gating |
| Pages (UI) | `src/pages/**` | No | No |
| Layout / Nav | `src/components/layout/**` | No | Yes — role gating |
| Models / Data | `src/models/**`, `src/data/seedData.js` | No | Medium |
| Server skeleton | `server/**` | No (placeholder only in M1) | No |
| Docs / Diagrams | `docs/**` | No | No |

Real-API gates per core §3.9 / §6.1 / §6.2 are **N/A for M1** — everything is
mock. The framework's "real-API stdout in report" rule does not apply.
Equivalent gate for M1: the Manual QA Checklist (brief §16) must pass before
the deployment is marked complete.

## Harness sanity gate

**None.** The QuantDeploy framework's R14 sanity reproduction rule is
**N/A** for this deployment — there is no numeric reproduction target.
Equivalent acceptance gate: **all 13 items of the Manual QA Checklist
(brief §16) pass end-to-end in a browser**, demonstrated via screenshots
or a recorded session in the final D-task.

## Tier classification (per core §6.3)

- **Tier 1** — copy edits, doc typos, single-component cosmetic fixes (<20 LOC, no logic).
- **Tier 2** — single service, single page, or single component group; <100 LOC.
- **Tier 3** — multi-service or full vertical slice; or any change that touches Auth/role gating.

Workers run `npm test` (or `vitest run`) for the affected service(s) +
manually exercise the affected page in the dev server before reporting done.

## User-approval gates

Halt and request user OK before:

1. **Initial MASTER_PLAN approval** (current state).
2. **Any addition or removal of features** beyond the brief's §5.1 Must-Have list.
3. **Final dev → main PR** (when M1 is reviewed stable).

## Brief deviations / clarifications already encoded

- The brief names many specialized "agents" (Services Agent, Auth Agent, Teacher Flow Agent, etc.). These map onto **sequential D-tasks** dispatched to our single Implementer session. No multi-agent fan-out.
- The brief mentions "Gemini CLI /init" — this is **N/A** for our setup (we're using Claude Code, not Gemini). Skip.

## Anti-patterns specific to EMS_M1

1. Do NOT introduce TypeScript mid-deployment if D001 chose JS (or vice versa). Decide once in D001.
2. Do NOT add real backend logic in M1 — Express skeleton must stay route-stub-only.
3. Do NOT put business logic in React components. Services own it.
4. Do NOT commit to `main` after the initial bootstrap. All work on `dev`.
5. Do NOT skip diagrams "to save time" — they are an explicit M1 acceptance criterion.
