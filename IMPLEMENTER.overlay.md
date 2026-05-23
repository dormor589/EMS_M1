# EMS_M1 — Implementer Overlay

Read this alongside `core/IMPLEMENTER_BRIEF.core.md`. Project-specific rules
that OVERRIDE conflicting core defaults for the EMS_M1 deployment.

## Stack

- **Client:** React 18+ with Vite, JavaScript (ES2022+). TypeScript only if D001 elected it.
- **Server (M1 skeleton only):** Node 20+ with Express 4.
- **NOT Python.** Ignore the "Always use python3" rule from core.

## Spec source

Sole source of truth for this milestone:
`deployments/EMS_M1/docs/spec_brief.txt` (plain-text mirror of the user-supplied DOCX).

You cite this file in code comments instead of `research_findings/`. Example:
`// Source: docs/spec_brief.txt §5.1 Must-Have Features`

There is NO `research_findings/` directory and NO `PRE_IMPLEMENTATION_HANDOFF.md`
for this deployment. If a core paragraph tells you to read those, skip — the
spec lives in `docs/spec_brief.txt`.

## File layout (per brief §6)

```
deployments/EMS_M1/
├── client/
│   ├── src/
│   │   ├── app/            (App.jsx, routes.jsx)
│   │   ├── components/     (layout/, shared/)
│   │   ├── pages/          (auth/, teacher/, student/)
│   │   ├── services/       (8 OOP service classes — see brief §8)
│   │   ├── data/seedData.js
│   │   ├── models/         (User.js, Exam.js, Question.js, Submission.js)
│   │   └── styles/
│   └── package.json
├── server/                 (Express skeleton — placeholder only in M1)
│   ├── src/{app.js,routes/,controllers/,services/,models/,middleware/}
│   └── package.json
├── docs/{explanation.txt, ai-work-log.txt, diagrams/, spec_brief.txt}
└── README.md
```

## Service classes (OOP — per brief §8)

Eight services, each as a class with a clear single responsibility:
`ConfigService, LoggerService, StorageService, NotifyService, MockApiService,
AuthService, ExamService, SubmissionService`. See brief §8 for method signatures.

- Services live in `client/src/services/<Name>Service.js`.
- React components consume services via imports — NO business logic in components.
- Storage layer: `localStorage` for M1. `StorageService` wraps it; nothing else touches `localStorage` directly.

## Models / Entities (per brief §7)

`User, Exam, Question, Submission, Answer` — plain JS classes or factory functions
with the field shape in brief §7. Answer is embedded in Submission.

Question types in M1: **Multiple Choice** and **Open Text** only.

## Roles

Two roles: `teacher`, `student`. Stored on the User model. Drive nav menu and
route guards via `AuthService.isTeacher() / isStudent()`.

## Exam status state machine

`Draft → Published → Closed`. Only Teachers transition status. Only `Published`
exams appear to Students.

## Tests

- **Vitest** preferred (Vite-native). Place under `client/src/**/__tests__/` or `client/tests/`.
- Service tests are mandatory (each service gets at least basic happy-path coverage).
- Component tests optional in M1; manual QA is the floor.
- Real-API integration tests: **N/A in M1** (everything mocked). Ignore core §4.6 / §3.9 — they apply to live external APIs which we don't have yet.

## Real-API discipline (core §4.6)

**N/A for M1.** There is no real exchange / API. The "paste stdout from a real
endpoint" rule does NOT apply. Equivalent gate: paste the result of
`npm run build` (or `vitest run`) into your implementer report, plus screenshots
or a step-by-step description of exercising the relevant flow in the dev server.

## R14 sanity gate

**N/A for M1.** No numeric reproduction target exists.

## Git workflow (per brief §10)

- All commits go to the `dev` branch.
- After your changes, stage + commit with a clear conventional-commit message
  (e.g., `feat: add ExamService and Submission model`).
- Do NOT push to `main`. Team Lead handles the dev → main PR at end of milestone.
- DO push to `dev` after each D-task so the user sees incremental progress on GitHub.

## Documentation deliverables

- Update `docs/explanation.txt` at end of each D-task that adds a user-facing feature (use the template from brief §14).
- Update `docs/ai-work-log.txt` with a short note: which agent (D-task), what was done, time taken.
- Diagrams (`.puml` or `.txt`) — D-task DXX will be dedicated to them.

## Constants

Magic numbers / config values live in `src/services/ConfigService.js`
(via methods like `getDefaultExamStatus()`, `getStorageKeys()`).
Per-service local constants OK inline only if truly local to one file.

## Anti-patterns specific to EMS_M1

1. NO business logic inside React component files. Move to services.
2. NO direct `localStorage.getItem/setItem` outside `StorageService`.
3. NO `console.log` in committed code — go through `LoggerService`.
4. NO real Postgres / JWT / bcrypt / WebSocket code in M1. Push to M2.
5. NO giant single-commit dumps. One module = one commit.
6. NO routing decisions or auth state stored in component-local state if multiple components need it — use AuthService.
