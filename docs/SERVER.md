# Server Architecture

Express 5 REST API over PostgreSQL. Runs on **:5050**.

---

## 1. Packages

### Runtime

| Package | Why |
|---|---|
| `express` 5 | HTTP framework |
| `pg` | PostgreSQL driver — raw SQL, no ORM |
| `bcryptjs` | Password hashing. Pure JS, so no native build step in Docker or CI |
| `jsonwebtoken` | Signing and verifying session tokens |
| `zod` | Request validation |
| `helmet` | Security headers |
| `express-rate-limit` | Protects the login and AI endpoints |
| `cors` | Origin allowlist for the browser |
| `dotenv` | Loads `.env` in development |

### Development

| Package | Why |
|---|---|
| `vitest` | Test runner |
| `supertest` | Drives the real Express app in-process, no port needed |

### Why no ORM

The schema is small and stable, and the interesting queries — the grade
distribution via `width_bucket`, per-question difficulty via a join — are
clearer as SQL than as a query builder. Repositories keep that SQL in one
place, which is most of what an ORM was going to provide.

## 2. Layers

```
routes/          URL → middleware chain → controller. No logic.
      │
controllers/     HTTP in, HTTP out. Unwrap the request, call a service,
      │          shape the response. No rules.
      │
services/        every business rule and every authorization check.
      │          Knows nothing about HTTP.
      │
db/repositories/ the only code that writes SQL.
      │
db/pool.js       the only code that opens a connection.
```

Supporting:

```
models/          five entity classes. Row → object, object → JSON.
middleware/      authenticate, requireRole, validate, errorHandler, notFound,
                 requestLogger
validation/      zod schemas
config/          every constant, read once at boot
utils/           ApiError, asyncHandler, logger
services/ai/     the AI provider abstraction
```

Two rules keep the layers honest: **a controller contains no `if` that decides
a business question**, and **a service contains no SQL**. Both are easy to
check by reading, and both are what make the services testable without HTTP and
the repositories replaceable without touching rules.

## 3. Middleware order

Order is deliberate — `app.js`:

```
helmet          security headers, before anything can respond
cors            reject disallowed origins before doing work
express.json    parse bodies (1 MB limit)
requestLogger   attach the finish listener before routing
/api routes     the application
notFound        anything unmatched → JSON 404, not Express's HTML
errorHandler    LAST. The single place an error becomes a response.
```

### The error handler

An `ApiError` carries a status and a message written for a client. **Anything
else is an unexpected fault**: logged in full server-side, returned as a bare
500. SQL text, stack traces and driver internals never reach a caller.

A few Postgres SQLSTATEs are translated into something actionable — `23505`
unique violation becomes 409, `23514` check violation becomes 422 — so a
constraint the application failed to anticipate still produces a sensible
response rather than a 500.

## 4. Authentication and authorization

**authenticate** — verifies the token signature, then **loads the user from the
database**. The role in the token is not trusted on its own, so an account that
has been deleted cannot keep acting on a token that has not yet expired.

**requireRole('teacher')** — authorization, deliberately separate from
authentication. Mounted per route.

**Ownership** is checked in the services, not the middleware, because it needs
the resource: a role check says "a teacher may edit exams", only the service
can say "*this* teacher may edit *this* exam".

Login returns the same error for an unknown email and a wrong password, and
hashes a dummy value when the user does not exist so both paths take
comparable time. Otherwise the response reveals which addresses are registered.

## 5. Data access

`db/pool.js` owns the single connection pool and exports `withTransaction`,
which commits on success, rolls back on throw, and always returns the client.

| Repository | Tables |
|---|---|
| `UserRepository` | `users` |
| `ExamRepository` | `exams`, `questions` |
| `SubmissionRepository` | `submissions`, `answers` |

Listing avoids N+1: exams and their questions are two queries regardless of how
many exams there are, not one per exam.

### Two queries worth reading

**`ExamRepository.update`** reconciles questions instead of replacing them.
See `ARCHITECTURE.md` §5 for why — the short version is that replacing would
cascade-delete every student answer.

**`SubmissionRepository.createAttempt`** uses `ON CONFLICT DO NOTHING` and reads
back the winner. Two requests can arrive at once — React's development double
effect, an impatient double click, a retried request — and a check-then-insert
would let both pass the check, with the second dying on the UNIQUE constraint.

## 6. API surface — 23 API endpoints, plus /health

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/exams                        role-aware
GET    /api/exams/:id
POST   /api/exams                        teacher
PUT    /api/exams/:id                    reconciling save
DELETE /api/exams/:id
POST   /api/exams/:id/publish
POST   /api/exams/:id/close

POST   /api/exams/:id/attempt            student — start or resume
PATCH  /api/attempts/:id/draft           student — autosave
POST   /api/attempts/:id/submit          student

GET    /api/exams/:id/submissions        teacher, owner only
GET    /api/submissions/mine             student
GET    /api/submissions/:id
POST   /api/submissions/:id/ai-grade     teacher — run the AI pass
PATCH  /api/submissions/:id/grade        teacher — edit scores
POST   /api/submissions/:id/publish      teacher — release to student

POST   /api/ai/exams/generate            teacher
GET    /api/ai/status                    which provider is active

GET    /api/analytics/overview           teacher
GET    /api/analytics/exams/:id          teacher, owner only

GET    /health                           unauthenticated
```

`/health` needs no token on purpose: a health check that requires credentials
cannot be used by the thing that needs to check health. It also queries the
database, so an API that is up but cannot reach Postgres reports itself
degraded rather than healthy.

## 7. Validation

zod schemas in `validation/schemas.js`, applied before any controller runs, so
services can assume well-formed input and a malformed request produces a
precise field-level 400 rather than a constraint violation surfacing as a 500.

The question schema checks each type separately, because a multiple-choice
question and an open-text one have genuinely different valid shapes — the first
needs at least two options and a correct answer within range, the second must
have neither.

`status` is deliberately absent from the exam update schema: the lifecycle
moves only through the dedicated publish and close endpoints, so a general
update cannot smuggle a transition past the state machine.

## 8. Configuration

All environment reading happens once, in `config/index.js`, which throws at
boot on a missing secret rather than at the first request that needs it.

| Variable | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | `production` requires `JWT_SECRET` and hides stack traces; `test` skips the rate limiter |
| `PORT` | 5050 | 5000 is taken by macOS AirPlay Receiver |
| `DATABASE_URL` | local Postgres | The only change needed to point at a managed database |
| `DATABASE_SSL` | auto | Auto-detects from the URL or a known provider; set explicitly to override |
| `JWT_SECRET` | dev-only default | **Required** in production; boot fails without it |
| `JWT_EXPIRES_IN` | `8h` | `.env.example` ships `7d` — an 8-hour token meant signing in again every session |
| `BCRYPT_ROUNDS` | 10 | |
| `CORS_ORIGINS` | `localhost:5173,4173` | Comma-separated allowlist |
| `NVIDIA_API_KEY` | unset | Unset means the AI features use the deterministic fallback |
| `NIM_MODEL` | `moonshotai/kimi-k3` | Grading. A reasoning model — slower, and worth it |
| `NIM_FAST_MODEL` | `meta/llama-3.1-70b-instruct` | Exam generation and the analytics summary |
| `NIM_BASE_URL` | `https://integrate.api.nvidia.com/v1` | Any OpenAI-compatible endpoint works |
| `AI_TIMEOUT_MS` | 90000 | |
| `LOG_LEVEL` | `info` | `debug` \| `info` \| `warn` \| `error` \| `silent` |

## 9. Testing

`npm test` — 156 tests across 7 files.

Unit tests cover pure logic with injected fakes. **Integration tests run against
a real PostgreSQL** (`exam_app_test`), because the CHECK and UNIQUE constraints
are part of the behaviour being tested: a mocked driver would accept a duplicate
submission and the test would pass while the system was broken.

`scripts/e2e.sh` additionally drives the whole workflow over real HTTP with
curl, asserting the security boundaries as well as the happy path.
