# EMS — Exam Management System

A full-stack web application for setting, sitting and marking online exams,
with AI-assisted exam generation and grading.

**Repository:** https://github.com/dormor589/EMS_M1 — submitted on the `dev` branch
**Deployment:** the application runs locally by design — `docker compose up`
starts everything. There is no public URL. The **database** is hosted: managed
PostgreSQL 16 on Render.

React 19 · Express 5 · PostgreSQL · JWT · NVIDIA NIM

---

## Running it

### With Docker — nothing else needed

```bash
git clone https://github.com/dormor589/EMS_M1
cd EMS_M1
git checkout dev

docker compose up -d
./scripts/docker-seed.sh
```

Open **http://localhost:5173**

### Without Docker

Requires Node 22 and PostgreSQL 14+.

```bash
createdb exam_app

cd server && npm install
cp .env.example .env
npm run db:reset
npm start                 # API on :5050

cd ../client && npm install
npm run dev               # client on :5173
```

### Log in

| Role | Email | Password |
|---|---|---|
| Teacher | `teacher@ems.dev` | `password` |
| Student | `student@ems.dev` | `password` |

Six students and fifteen submissions are seeded, so the analytics dashboard
shows a real distribution.

For a fuller cohort — ten students across six exams, with grades produced from
an ability model rather than picked by hand — run `npm run db:seed:class` in
`server/`. It is additive and idempotent. See
[`docs/PROCESS.md`](docs/PROCESS.md#1-running-it) for the accounts it creates.

---

## What it does

### Teachers

- Create exams with multiple-choice and open-text questions, each carrying a weight
- **Generate an exam with AI** — describe it, review the draft, edit, save
- Publish (Draft → Published → Closed), and edit a live exam if a mistake slips through
- Review submissions question by question
- **Run AI grading** — marks open answers and proposes a score per question
- Override anything the AI proposed; the original proposal stays visible
- Publish grades when ready — students see nothing before that
- **Analytics** — grade distribution, per-question difficulty, pass rates, and an AI-written summary

### Students

- See published exams only
- Sit an exam with a **live countdown**; answers **autosave to the server**
- Automatic submission when time runs out
- See grades and per-question feedback once the teacher publishes them

---

## Main pages

| Path | Who | Purpose |
|---|---|---|
| `/login`, `/register` | anyone | Authentication |
| `/teacher` | teacher | Dashboard |
| `/teacher/exams` | teacher | Exam list, publish, close |
| `/teacher/exams/new`, `/:id/edit` | teacher | Question editor |
| `/teacher/exams/generate` | teacher | ✨ AI exam generation |
| `/teacher/submissions` | teacher | Submissions by exam |
| `/teacher/submissions/:id` | teacher | Marking screen, AI grading, publish |
| `/teacher/analytics` | teacher | Statistics |
| `/student` | student | Dashboard |
| `/student/exams` | student | Available exams |
| `/student/exams/:id` | student | Sit the exam |
| `/student/grades` | student | Published grades |

## Main API endpoints

23 in total; the ones that carry the interesting behaviour:

| Endpoint | Notes |
|---|---|
| `POST /api/auth/login` | Returns a JWT; identical error for unknown email and wrong password |
| `GET /api/exams` | Role-aware — a teacher sees their own, a student sees published only |
| `PUT /api/exams/:id` | Reconciles questions so ids survive and answers are not destroyed |
| `POST /api/exams/:id/attempt` | Starts or **resumes**; a refresh cannot reset the clock |
| `PATCH /api/attempts/:id/draft` | Autosave |
| `POST /api/attempts/:id/submit` | Marks multiple choice from the answer key |
| `POST /api/submissions/:id/ai-grade` | Runs the AI pass; result is a **draft** |
| `POST /api/submissions/:id/publish` | Releases the grade to the student |
| `POST /api/ai/exams/generate` | Returns a draft; **saves nothing** |
| `GET /api/analytics/exams/:id` | Distribution and per-question difficulty |

Full request and response shapes: [`docs/JSON-MODELS.md`](docs/JSON-MODELS.md)

---

## Architecture

```
React SPA  ──HTTP+JWT──▶  Express API  ──SQL──▶  PostgreSQL
  :5173                     :5050                 5 tables
                              │
                              └──HTTPS──▶  NVIDIA NIM  (optional)
```

**Every business rule lives on the server.** Milestone 1 enforced them in the
browser, which is not enforcement — a client can be edited or bypassed with
`curl`. The exam lifecycle, the one-submission rule, ownership checks, the
timer, and the fact that students never receive the answer key are all
server-side, with database constraints as the final backstop.

Documents:

| | |
|---|---|
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | The whole system, data flow, who stores what |
| [`docs/CLIENT.md`](docs/CLIENT.md) | React layers, services, component hierarchy |
| [`docs/SERVER.md`](docs/SERVER.md) | API layers, middleware, endpoints |
| [`docs/JSON-MODELS.md`](docs/JSON-MODELS.md) | Request and response shapes |
| [`docs/PROCESS.md`](docs/PROCESS.md) | Configuration, testing, logging, deployment |
| [`docs/MILESTONES.md`](docs/MILESTONES.md) | What was built when, and every design decision |

### Interface

Styled in hand-written CSS with no framework. Oxford navy over slate paper with
a brass accent; Spectral for titles and exam questions, IBM Plex for interface
and data. **Violet is reserved exclusively for AI surfaces**, so the system's
honesty about what a model produced is visible at a glance.

Three grounds, scoped with `body:has()` and no JavaScript: a ledger-paper
default, warm cream while sitting an exam, and a dark instrument panel for
analytics. All motion respects `prefers-reduced-motion`.

Details in [`docs/CLIENT.md`](docs/CLIENT.md) §7.

Diagrams — [`docs/diagrams/`](docs/diagrams/):

| | |
|---|---|
| [ERD](docs/diagrams/erd.png) | Five tables, keys, constraints |
| [Class diagram](docs/diagrams/class-diagram.png) | Client and server classes |
| [Use cases](docs/diagrams/use-case-diagram.png) | Every capability, by actor |
| [Sequence: login](docs/diagrams/sequence-login.png) | Where the password stops |
| [Sequence: take + grade](docs/diagrams/sequence-take-and-grade.png) | Timer, autosave, publish gate |
| [Sequence: AI generation](docs/diagrams/sequence-ai-generate.png) | Validation and fallback |
| [Component hierarchy](docs/diagrams/component-hierarchy.txt) | React tree |

---

## The AI features

Three, all optional:

1. **Exam generation** — a description becomes a complete exam. Returned as a
   **draft for review**, never saved automatically, because a generated answer
   key can be confident and wrong.
2. **Grading** — multiple choice is marked from the answer key in code; only
   open-text answers reach the model. A twelve-question exam with two open
   questions costs **one** API call. The result is a draft the teacher edits
   and publishes.
3. **Analytics narrative** — the figures come from SQL; the model only writes
   the commentary, so a provider outage costs the prose and none of the data.

### It runs without an API key

Set `NVIDIA_API_KEY` for the real thing. Without it, every feature still works
on a deterministic fallback — exams from templates, open answers scored by
comparing them against the question's vocabulary. It is visibly less capable
and says so in its own output, but it is a real implementation, not a stub.

That exists so this project runs for someone who is not its author. An
application whose headline features are dead on an examiner's machine has not
really shipped them.

---

## Testing

```bash
cd server && npm test        # 156 tests
cd client && npm test        # 151 tests
cd client && npm run lint    # clean

cd server && npm run test:e2e   # 34 checks over real HTTP
```

Integration tests run against a real PostgreSQL rather than a mock, because the
CHECK and UNIQUE constraints are part of the behaviour being tested.

CI runs all of it, plus both Docker builds, on every push.

---

## Project layout

```
client/          React SPA
  src/
    pages/       screens, by role
    components/  layout and route guards
    services/    all logic and I/O
    models/      pure entity classes

server/          Express API
  src/
    routes/         URL → middleware → controller
    controllers/    HTTP in, HTTP out
    services/       business rules and authorization
      ai/           provider abstraction
    db/
      repositories/ the only SQL
      schema.sql
    models/         five domain entities
    middleware/     auth, validation, errors
    validation/     zod schemas
  scripts/e2e.sh

docs/            architecture, diagrams, decisions
docker-compose.yml
```
