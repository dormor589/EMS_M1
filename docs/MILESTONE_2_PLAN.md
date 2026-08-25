# EMS — Milestone 2 Plan

> **This is the plan as agreed before implementation began.** It is kept as a
> record of what was decided and why. For what was actually built — including
> where the plan changed and the reasons — see
> [`MILESTONES.md`](MILESTONES.md).
>
> Known differences: the plan kept a `VITE_API_MODE=mock` fallback for the
> client (dropped — it would have meant maintaining a parallel implementation
> of every service); it listed 21 endpoints (23 were built); and it named
> Anthropic as an optional provider (not implemented — NVIDIA NIM plus the
> deterministic fallback cover the same ground); and it named
> `llama-3.3-70b-instruct` as the model, where the shipped system uses
> `kimi-k3` for grading and `llama-3.1-70b-instruct` for generation and
> analytics — both chosen by measuring latency and grading quality rather than
> by assumption.

**Project:** Full Stack Exam Management System
**Repository:** https://github.com/dormor589/EMS_M1
**Status:** planning complete — implementation not started

Milestone 1 delivered a React client with a mocked `localStorage` persistence
layer. Milestone 2 replaces that with a real backend: an Express API, a
PostgreSQL database, JWT authentication, and an AI service for exam generation,
grading, and analytics.

---

## 1. Decision log

| # | Decision | Rationale |
|---|---|---|
| D1 | **Postgres on Render**; local Postgres during development | Cloud DB satisfies "database integration"; local dev needs no network dependency |
| D2 | **App runs locally only** — no cloud app hosting | Scope decision; Docker + one-command run mitigates the brief's deployment bullet |
| D3 | **No commits during development; one commit and one push at the end, on explicit approval** | Work in progress is never published. Timestamped folder snapshots provide rollback in place of git history |
| D4 | **Teacher can edit a published exam**, with re-grade flagging | Typos must be fixable; grading-affecting edits flag affected submissions instead of silently corrupting them |
| D5 | **Whole-exam save** with server-side reconciliation | Matches the existing `EditExamPage`; the server diffs incoming vs. stored so question ids survive and answers stay attached |
| D6 | **AI grading is teacher-triggered, editable, with a publish gate** | The AI proposes, the teacher decides |
| D7 | **Grade = Σ(score × weight) ÷ Σ(weight)**; multiple-choice scored in code | Weights self-normalize so the grade can never exceed 100; the model only judges prose |
| D8 | **In:** timer, server autosave, pass mark. **Out:** admin role | Depth over breadth |
| D9 | **NVIDIA NIM as the AI provider**, behind a provider interface | Free, key already available, verified working. No paid API credits required |

---

## 2. Stack

| Layer | Technology |
|---|---|
| Client | React 19, Vite 8, react-router 7, Vitest |
| Server | Node 22, Express 5, `pg`, `bcryptjs`, `jsonwebtoken`, `helmet`, `express-rate-limit`, `zod` |
| Database | PostgreSQL 14 (local) → Render (final) |
| AI | NVIDIA NIM, OpenAI-compatible API, `meta/llama-3.3-70b-instruct` |
| Tests | Vitest + supertest |
| Tooling | Docker, docker-compose, GitHub Actions |

---

## 3. Architecture

```
┌─────────────────────────────────────────────┐
│ CLIENT   React SPA (localhost:5173)         │
│   pages → services → HttpApiService         │
│   JWT held in localStorage                  │
└──────────────────┬──────────────────────────┘
                   │ HTTP/JSON + Bearer token
┌──────────────────▼──────────────────────────┐
│ SERVER   Express API (localhost:5000)       │
│   routes → controllers → services →         │
│            repositories                     │
│   middleware: authenticate, requireRole,    │
│               validate, errorHandler        │
└────────┬───────────────────────┬────────────┘
         │ SQL                   │ HTTPS
┌────────▼─────────┐   ┌─────────▼───────────┐
│ PostgreSQL       │   │ NVIDIA NIM          │
│ users, exams,    │   │ generation, grading │
│ questions,       │   │ analytics narrative │
│ submissions,     │   └─────────────────────┘
│ answers          │
└──────────────────┘
```

**Who stores what.** All persistent state lives in PostgreSQL. The client holds
only the JWT and transient UI state. The AI provider is stateless — it receives
a prompt and returns JSON; nothing is persisted on their side.

**How data flows.** A page calls a client service, which calls `HttpApiService`,
which issues an HTTP request carrying the JWT. The server authenticates the
token, authorizes the role, validates the payload, runs business logic in a
service, and reads or writes through a repository. Responses are plain JSON
shaped like the client's domain models.

---

## 4. Database schema

Five tables, mapping 1:1 onto the five domain models shared by client and server.

### users
`id`, `name`, `email` (unique, lowercase), `password_hash` (bcrypt), `role`
(`teacher` | `student`), `created_at`

### exams
`id`, `title`, `description`, `duration_minutes`, `passing_grade`, `status`
(`Draft` | `Published` | `Closed`), `created_by` → users, `generated_by_ai`,
`ai_prompt`, `created_at`, `updated_at`

### questions
`id`, `exam_id` → exams, `type` (`multiple-choice` | `open-text`), `text`,
`options` JSONB, `correct_answer`, `weight`, `position`, `created_at`

CHECK constraint: a multiple-choice question needs at least two options and a
valid `correct_answer`; an open-text question must have neither.

### submissions
`id`, `exam_id`, `student_id`, `status` (`in_progress` | `submitted` |
`ai_graded` | `graded`), `started_at`, `expires_at`, `submitted_at`, `grade`,
`feedback`, `graded_by` (`teacher` | `ai` | `ai+teacher`), `graded_at`,
`needs_regrade`

UNIQUE `(exam_id, student_id)` — one attempt per student.

### answers
`id`, `submission_id`, `question_id`, `value`, `is_correct`, `ai_score`,
`ai_feedback`, `score`, `feedback`, `updated_at`

UNIQUE `(submission_id, question_id)`.

### Design notes

- The submission row is created when a student **opens** the exam, not when
  they submit. It therefore carries the timer (`started_at`, `expires_at`) and
  the autosaved answers before it ever carries a grade. No separate attempts
  table is needed, and the existing UNIQUE constraint already prevents a second
  attempt.
- `ai_score` / `ai_feedback` are kept separate from the final `score` /
  `feedback` so a teacher override never erases what the model proposed. This
  powers the "AI proposed 85 — you changed it to 92" display.
- `passed` is computed (`grade >= passing_grade`), never stored, so changing an
  exam's pass mark cannot leave stale values behind.
- JSONB is used only for `questions.options`, whose length genuinely varies by
  question type. Everything else is a typed column with real constraints.

---

## 5. Submission lifecycle

```
student opens exam
      ↓
[in_progress]   timer running, answers autosaving to the server
      ↓         auto-submits when expires_at passes
[submitted]     teacher sees "not graded yet"
      ↓         ← teacher clicks "Run AI grading"
[ai_graded]     DRAFT — teacher only, the student sees nothing
      ↓         ← teacher edits any score or comment, clicks "Publish grade"
[graded]        visible to the student
```

A teacher may also grade entirely by hand (`submitted` → `graded`), skipping
the AI. The AI is an accelerator, never a requirement.

---

## 6. API surface

```
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

GET    /api/exams                      role-aware: teacher → own, student → published
GET    /api/exams/:id
POST   /api/exams                      teacher
PUT    /api/exams/:id                  reconciling save (D5)
DELETE /api/exams/:id
POST   /api/exams/:id/publish          Draft → Published
POST   /api/exams/:id/close            Published → Closed

POST   /api/exams/:id/attempt          student — start, returns expires_at
PATCH  /api/attempts/:id/draft         student — autosave
POST   /api/attempts/:id/submit        student — submit

GET    /api/exams/:id/submissions      teacher / owner
GET    /api/submissions/mine           student
GET    /api/submissions/:id
POST   /api/submissions/:id/ai-grade   teacher — run the AI pass
PATCH  /api/submissions/:id/grade      teacher — edit scores and feedback
POST   /api/submissions/:id/publish    teacher — release to the student

POST   /api/ai/exams/generate          teacher — description → draft exam
GET    /api/ai/status                  which provider is active
GET    /api/analytics/exams/:id        per-exam statistics
GET    /api/analytics/overview         teacher cohort view
```

### Reconciling save (D5)

`PUT /api/exams/:id` receives the whole exam. The repository does **not** wipe
and re-insert questions — that would change their ids and cascade-delete every
existing answer. Instead it reconciles inside one transaction:

| Incoming question | Action |
|---|---|
| Has an id that exists | `UPDATE` in place — id preserved, answers stay attached |
| Has no id | `INSERT` |
| Stored but absent from the payload | `DELETE` — flagged as grading-affecting |

Because the server compares incoming against stored, it already knows what
changed — so the "3 students have submitted; their grades need re-running"
warning falls out of the same comparison.

---

## 7. AI service

```
AiService                  provider-agnostic business logic
  ├── NimProvider          DEFAULT — NVIDIA NIM, free, verified
  ├── AnthropicProvider    optional
  └── FallbackProvider     no key — templates + keyword scoring
```

Provider selection at startup: `NVIDIA_API_KEY` → NIM; `ANTHROPIC_API_KEY` →
Anthropic; neither → fallback. A retired model (HTTP 410) falls through to the
fallback rather than crashing — NIM models do reach end of life.

**Exam generation.** A description such as *"intro React exam, 8 questions,
mixed difficulty, 45 minutes"* returns a title, description, duration, pass
mark, and questions with type, text, options, correct answer, and weights
summing to 100. The teacher reviews and edits before saving. Provenance is
recorded in `generated_by_ai` and `ai_prompt`.

**Grading.** Multiple-choice is scored in code (100 or 0, no API call).
Open-text answers go to the model, which returns a 0–100 score and written
feedback per answer. An exam with 10 multiple-choice and 2 open questions costs
two API calls, not twelve.

**Analytics narrative.** SQL produces the statistics; the model writes the
summary layered on top.

**Verified working.** Live calls against
`meta/llama-3.3-70b-instruct` produced valid grading JSON (133 tokens) and a
complete four-question exam with weights summing to exactly 100 (341 tokens).

**Keys are never committed.** `.env` stays gitignored; the README documents how
to obtain a free key at build.nvidia.com.

---

## 8. Grading model

```
grade = Σ(score × weight) ÷ Σ(weight)
```

The teacher assigns each question a **weight** (how much it matters). Each
answer receives a **score** from 0–100 (how well it was answered) — computed
for multiple-choice, model-judged for open-text.

| Q | Type | Weight | Score | Contributes |
|---|---|---|---|---|
| 1 | multiple-choice | 20 | 100 (correct) | 20.0 |
| 2 | multiple-choice | 20 | 0 (wrong) | 0.0 |
| 3 | open-text | 30 | 85 (AI) | 25.5 |
| 4 | open-text | 30 | 70 (AI) | 21.0 |
| | | **100** | | **66.5** |

Dividing by the sum of weights rather than by 100 means the weights
self-normalize: adding a question to an exam whose weights already total 100
cannot produce a grade above 100, and no validation has to block a save while
the teacher is mid-edit. The UI still shows a live "Total weight: 100 ✓"
indicator so typos stay visible.

The teacher edits at question level and the total recalculates. Because the
model's per-question scores are independent of the weights, an exam can be
re-weighted after grading without re-running the AI.

---

## 9. Build phases

### Phase 1 — Database
- [ ] Apply the schema (weight, passing_grade, four-state submissions, ai/final split, timer columns)
- [ ] Seed: bcrypt users, keeping `teacher@ems.dev` / `student@ems.dev`, plus ~6 students and ~15 submissions so analytics has data to display
- [ ] `db:migrate` / `db:seed` scripts
- [ ] Delete the three stale demo query scripts

### Phase 2 — Backend API
- [ ] Layers: `config` → `db/repositories` → `services` → `controllers` → `routes`, plus `middleware` and `utils`
- [ ] Five OOP entity models mirroring the client
- [ ] bcrypt + JWT, `authenticate` and `requireRole` middleware
- [ ] Move the exam state machine and one-submission rule server-side
- [ ] Reconciling exam save in a transaction
- [ ] Timer enforcement — reject submissions arriving past `expires_at`
- [ ] zod validation, central error handler, helmet, CORS allowlist, auth rate limiting
- [ ] All 21 endpoints
- [ ] Remove `@anthropic-ai/sdk` (installed during exploration; no longer the default path)

### Phase 3 — AI service
- [ ] Provider interface plus NIM adapter (thin `fetch` wrapper)
- [ ] Generation, grading, and analytics narrative
- [ ] Fallback provider
- [ ] Model-retirement handling

### Phase 4 — Client migration
- [ ] `HttpApiService` — drop-in replacement for `MockApiService`
- [ ] `AuthService` → JWT
- [ ] Exam and Submission services → thin API clients
- [ ] `ConfigService` → API base URL, live mode
- [ ] New UI: AI generation page, analytics dashboard, AI-grade and publish controls, exam countdown
- [ ] `App.jsx` — drop `seedIfEmpty`, add auth bootstrap

### Phase 5 — Testing
- [ ] Rework client tests — `AuthService` tests break, since JWT replaces password comparison
- [ ] Server unit tests: services, state machine, grading math, auth
- [ ] API integration tests (supertest) against a test database
- [ ] Target: suite green, plus 60–80 server tests

### Phase 6 — Local tooling
- [ ] Dockerfiles for client and server, `docker-compose.yml` including Postgres
- [ ] `.env.example` on both sides
- [ ] Structured request logging
- [ ] GitHub Actions running lint and tests

### Phase 7 — Documentation

| Deliverable | Status |
|---|---|
| README — repository URL, features, main pages and APIs | rewrite |
| General architecture — client/server/DB/AI, data flow | new |
| Client architecture — packages, component hierarchy | update |
| Server architecture — packages, layered design | new |
| Database ERD | new |
| JSON models | new |
| OOP UML class diagram | update (client-only today) |
| Three sequence diagrams — login, take + grade exam, AI generation | new |
| Milestones and branch structure | update |
| Work processes — configuration, Docker, unit tests, logs | new |

---

## 10. Git workflow

No git operations are performed during development. All changes remain in the
working tree, uncommitted, until the milestone is complete. At that point a
single commit is created and pushed, only on explicit approval.

Rollback during development is provided by timestamped folder snapshots taken
at each stage boundary, not by git history.

---

## 11. Required inputs

1. **Render Postgres URL** — needed only at the end; development runs against
   local PostgreSQL.
2. Nothing else — the NVIDIA API key is already configured.

---

## 12. Risks

| Risk | Detail |
|---|---|
| Test rework | The 221 existing tests assume `localStorage`. Expect genuine rework, not edits — particularly `AuthService`. |
| Documentation volume | Half of the Phase 7 deliverables do not exist yet, and documentation is a graded criterion. |
| Model retirement | NIM models reach end of life (`z-ai/glm-5.1` has already done so). Pin a model, make it configurable, and handle 410 by falling through to the fallback. |
| No cloud deployment | Per D2, the app runs locally only. The brief lists cloud deployment as a requirement; Docker and a documented one-command run partially mitigate this. |
