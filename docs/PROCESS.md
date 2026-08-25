# Working Practices, Configuration and Deployment

How the project is configured, run, tested and observed.

---

## 1. Running it

### With Docker — nothing else installed

```bash
git clone https://github.com/dormor589/EMS_M1
cd EMS_M1
docker compose up -d
./scripts/docker-seed.sh
```

- client — http://localhost:5173
- API — http://localhost:5050
- Postgres — localhost:5433 (exposed so you can inspect it with `psql`)

Seeding is a separate step on purpose: it truncates every table, so it must be
a deliberate act rather than something that happens on every restart.

### Without Docker

Requires Node 22 and PostgreSQL 14+.

```bash
createdb exam_app

cd server
npm install
cp .env.example .env          # defaults work for local Postgres
npm run db:reset              # build the schema and seed
npm start                     # :5050

cd ../client
npm install
npm run dev                   # :5173
```

### Demo accounts

| Role | Email | Password |
|---|---|---|
| Teacher | `teacher@ems.dev` | `password` |
| Teacher | `lecturer@ems.dev` | `password` |
| Student | `student@ems.dev` | `password` |
| Students | `maya@` `omar@` `noa@` `yuval@` `tamar@ems.dev` | `password` |

`npm run db:seed` creates those, together with four exams and fifteen
submissions.

**A larger cohort is available for demonstrating the analytics** — ten students
sitting six exams. Their grades are not hand-picked: each student is given an
ability, each question a difficulty, every answer is simulated from the two,
and the grade is then computed by the application's own `computeGrade()`, so a
seeded grade and a grade the app would calculate agree by construction.

| Role | Email | Password |
|---|---|---|
| Students | `noa.shapira@` `itay.benami@` `shira.mizrahi@` `adam.peretz@` `yael.avrahami@` `roi.katz@` `lior.dahan@` `tamar.segal@` `eitan.malka@` `hila.barkat@class.ems.dev` | `password` |

```
npm run db:seed:class:dry   # print the resulting distribution, write nothing
npm run db:seed:class       # write it
```

Additive and idempotent: it never truncates, and re-running reproduces
identical numbers. Two submissions are deliberately left awaiting grading and
two as unpublished AI drafts, so the grading and publish steps can be
demonstrated live. The exams belong to the teacher account named at the top of
`server/src/db/seedDemoClass.js`.

## 2. Configuration

Nothing is hard-coded. The server reads its environment once, at boot, in
`config/index.js`, and **throws immediately if a required secret is missing** —
rather than at the first request that happens to need it.

### Server — `server/.env`

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` requires `JWT_SECRET`; `test` skips the rate limiter |
| `PORT` | 5050 | Not 5000: macOS AirPlay Receiver occupies it |
| `DATABASE_URL` | local Postgres | The only change needed to point at a managed database |
| `DATABASE_SSL` | auto-detect | Explicit override; auto-detection reads the URL and known providers |
| `JWT_SECRET` | dev-only default | **Required in production** — boot fails without it |
| `JWT_EXPIRES_IN` | `8h` | `.env.example` ships `7d` — an 8-hour token meant signing in again every session |
| `BCRYPT_ROUNDS` | 10 | |
| `CORS_ORIGINS` | `localhost:5173,4173` | Comma-separated allowlist |
| `NVIDIA_API_KEY` | unset | Unset ⇒ the AI features use the deterministic fallback |
| `NIM_MODEL` | `moonshotai/kimi-k3` | Grading. A reasoning model — slower, and worth it |
| `NIM_FAST_MODEL` | `meta/llama-3.1-70b-instruct` | Exam generation and the analytics summary |
| `NIM_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Any OpenAI-compatible endpoint works |
| `AI_TIMEOUT_MS` | 90000 | NIM latency varies widely, 10–45s is normal |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` \| `silent` |

### Client — `client/.env.development`

| Variable | Default |
|---|---|
| `VITE_API_URL` | `http://localhost:5050/api` |

Vite **inlines** `VITE_*` variables at build time, so this cannot be changed by
setting an environment variable on a running container — it is a build
argument in the Dockerfile for exactly that reason.

### Secrets

`.env` files are gitignored. `.env.example` is committed with placeholders, so
a clone knows what to provide without anything real being published.

## 3. Database

| Command | Effect |
|---|---|
| `npm run db:migrate` | Build the schema (drops and recreates) |
| `npm run db:seed` | Insert the demo data |
| `npm run db:reset` | Both |
| `npm run db:reset:force` | Both, overriding the safety check below |
| `npm run db:seed:class` | Add the ten-student cohort (additive — truncates nothing) |
| `npm run db:seed:class:dry` | Print the distribution it would produce, write nothing |

**Seeding refuses to destroy real accounts.** If anyone has registered through
the app, `db:seed` stops and names them rather than silently truncating their
work:

```
[seed] REFUSING TO RUN — this would delete 1 account(s) that were
       registered through the app:
         someone@example.com
```

Migration is destructive by design: for a project of this size a clean rebuild
is more useful than an incremental migration history, and the schema is small
enough to re-seed in under a second.

## 4. Testing

| Where | Command | Count |
|---|---|---|
| Server | `cd server && npm test` | 156 |
| Client | `cd client && npm test` | 151 |
| End-to-end | `cd server && npm run test:e2e` | 34 checks |
| Lint | `cd client && npm run lint` | clean |

### Three layers, on purpose

**Unit** — pure logic with injected fakes. The grade formula, the entity
models, the AI validation. No database, no network, milliseconds.

**Integration** — real HTTP through the real Express app via supertest, against
a **real PostgreSQL** (`exam_app_test`). Not a mock: the CHECK and UNIQUE
constraints are part of the behaviour being tested. A mocked driver would
accept a duplicate submission and the test would pass while the system was
broken.

**End-to-end** — `scripts/e2e.sh` drives the whole workflow with `curl` and
asserts the security boundaries as well as the happy path: answer-key leakage,
role enforcement, cross-teacher isolation, and that editing an exam does not
destroy existing answers.

```bash
cd server
npm run db:reset
npm start &
npm run test:e2e
```

### What writing the tests found

Four real defects, none of which had shown up in manual use:

1. `POST /exams/:id/attempt` returned 409 for an unpublished exam where `GET`
   returned 404, letting a student distinguish "no such exam" from "draft exam"
   by probing ids.
2. A missing import in `aiRoutes.js` that would have 500'd every generation
   request.
3. An SSL heuristic that assumed "not localhost means remote", breaking
   docker-compose entirely.
4. The rate limiter blocking the suite — correct behaviour, now skipped under
   test rather than weakened.

## 5. Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

| Job | Does |
|---|---|
| **server** | Starts a Postgres service container, builds the schema, runs 156 tests |
| **client** | Lints, runs 151 tests, builds |
| **docker** | Builds both images, so a broken Dockerfile fails CI rather than a demo |

## 6. Logging

`utils/logger.js` is the only code permitted to call `console`, so the format
lives in one place and log level is honoured consistently.

One line per request, with its outcome and duration:

```
2026-08-23T12:11:02.910Z INFO  POST /api/submissions/39560ca1/ai-grade {"status":200,"ms":18946,"user":"a1b2..."}
2026-08-23T12:11:02.902Z INFO  AI call complete {"model":"moonshotai/kimi-k3","tokens":467}
2026-08-23T11:15:22.451Z WARN  AI marking failed, using the fallback {"error":"..."}
```

**Request bodies are never logged** — they carry passwords. 4xx logs at `warn`,
5xx at `error`, so a genuine fault is distinguishable from a rejected request.

An unexpected error is logged in full server-side and returned as a bare 500,
so SQL text and stack traces never reach a client.

## 7. Deployment

**The application runs locally by design** (decision D2) — it is not hosted
anywhere and has no public URL. `docker compose up` brings up client, API and
database together.

**The database is hosted.** It runs on Render — managed PostgreSQL 16, Frankfurt
region. Pointing the API at it, or back at a local PostgreSQL, is a change to
`DATABASE_URL` alone and nothing else; both connection strings are kept in
`server/.env` with one commented out. TLS is detected from the connection
string or the provider's hostname, and can be forced either way with
`DATABASE_SSL`.

(That instance is on Render's free tier, which deletes a database 30 days after
it is created. If `/health` reports the database as unreachable, recreate it and
re-run `npm run db:migrate && npm run db:seed`.)

Deploying the API itself would need a Node host and the same environment
variables; the Dockerfile already produces a suitable image, running as a
non-root user with a healthcheck that verifies database connectivity rather
than merely that the process is alive.

## 8. Version control

Conventional commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`) throughout.
Milestone 1 was developed and pushed on `dev`; Milestone 2 was developed
locally and pushed once, complete. See `MILESTONES.md`.
