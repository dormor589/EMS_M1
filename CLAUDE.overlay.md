# EMS_M1 — Project Coding Standards (overlay over core/CLAUDE.core.md)

This deployment is a **Full Stack Exam Management System, Milestone 1** —
a React/Vite client with an Express backend skeleton. The core framework's
defaults assume Python; the following rules OVERRIDE for this project.

## Stack & language

- **Client:** React 18+ with Vite, JavaScript (ES2022+) or TypeScript (team's call — record decision in D001).
- **Server skeleton:** Node.js + Express. Implementation minimal in M1.
- Default language: JavaScript with JSDoc type annotations (TypeScript optional, decide in D001).
- **NOT Python.** The core CLAUDE.core.md rule "Always use python3" does NOT apply here.

## File paths

- All paths within the deployment folder are relative to
  `deployments/EMS_M1/`. Use Node-native `path.resolve()` / `path.join()`,
  NOT pathlib.

## Secrets

- No hardcoded API keys / tokens. Env vars only (`.env.local`, gitignored).
- M1 uses MOCK auth — no real JWT secrets needed. Future milestones will add them.

## Linting / formatting

- ESLint + Prettier on the client. Standard React+Vite recommended config.
- Husky pre-commit hook optional in M1.

## Documentation rules

- Every non-trivial function: JSDoc with `@param`, `@returns`, `@throws`.
- Service classes get a class-level JSDoc summary.
- `docs/explanation.txt` is **plain text** (not Markdown) per the brief.
- Diagrams as `.puml` (PlantUML) or `.txt` in `docs/diagrams/`.

## Logging

- Client: `LoggerService` (wraps `console.{info,warn,error}` + optional remote sink later).
- NEVER use raw `console.log` in committed code outside `LoggerService`.

## Magic numbers / constants

- Per-service constants in `src/services/<Service>/constants.js` (or inline `const` if truly local).
- Document the rationale for any non-obvious value.

## Testing

- Vitest preferred (Vite-native). Jest acceptable if needed.
- React Testing Library for component tests.
- M1 minimum: smoke tests on each service + manual QA checklist passes.
- Real DB / real API testing N/A in M1 (everything mock).

## Git workflow (BINDING per brief §10)

- Work happens on the **`dev` branch**, not `main`.
- After `git init` + first commit on `main`, create and switch to `dev`:
  `git checkout -b dev && git push -u origin dev`.
- Open a PR `dev → main` only when M1 is reviewed and stable (Team Lead + user gate).
- Each module/feature = its own commit. No giant blob commits.

## Out of scope for M1

Hard NO in M1 (per brief §5.3): real JWT/bcrypt, Postgres, real grading workflow,
WebSockets, AI grading, CI/CD, cloud deploy, microservices, advanced analytics.
If a worker proposes any of these, REJECT — push to Milestone 2.
