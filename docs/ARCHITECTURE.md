# System Architecture

Exam Management System — how the parts fit together, who talks to whom, and
where each piece of data lives.

---

## 1. The whole system

```
┌──────────────────────────────────────────────────────────────┐
│  CLIENT — React 19 SPA (Vite)                    :5173       │
│                                                              │
│    pages/  ──▶  services/  ──▶  HttpApiService               │
│    (UI)         (business)      (the only code that          │
│                                  leaves the browser)         │
│                                                              │
│    Holds: a JWT and the current user. Nothing else.          │
└───────────────────────────┬──────────────────────────────────┘
                            │  HTTP + JSON
                            │  Authorization: Bearer <JWT>
┌───────────────────────────▼──────────────────────────────────┐
│  SERVER — Express 5 API                          :5050       │
│                                                              │
│    routes  ──▶  controllers  ──▶  services  ──▶ repositories │
│      │                                                       │
│      └─ middleware: authenticate, requireRole,               │
│                     validate, errorHandler                   │
│                                                              │
│    Owns: every business rule. Trusts nothing from the client. │
└──────────┬────────────────────────────────┬──────────────────┘
           │ SQL                            │ HTTPS
┌──────────▼──────────────┐   ┌─────────────▼────────────────┐
│  PostgreSQL             │   │  AI provider (NVIDIA NIM)    │
│                         │   │                              │
│  users                  │   │  exam generation             │
│  exams                  │   │  open-text grading           │
│  questions              │   │  analytics narrative         │
│  submissions            │   │                              │
│  answers                │   │  Stateless. Holds no data.   │
│                         │   │  Optional — see §6.          │
│  The single source      │   └──────────────────────────────┘
│  of truth.              │
└─────────────────────────┘
```

## 2. Who stores what

| Data | Lives in | Notes |
|---|---|---|
| Users, exams, questions, submissions, answers | **PostgreSQL** | The only durable store |
| Password | **PostgreSQL**, as a bcrypt hash | Never leaves the server, never reversible |
| Session | **Browser localStorage**, as a signed JWT | Expires after 7 days (`JWT_EXPIRES_IN`); contains no secret |
| Current user's name/role | **Browser localStorage**, cached | Public fields only, re-validated at every boot |
| Exam answers in progress | **PostgreSQL**, autosaved | Not the browser — see §5 |
| AI prompts and responses | **Nowhere** | The provider is stateless; only the resulting grade is stored |

The browser is a **view**. Clearing it costs a login, nothing else.

## 3. How data flows

A request, end to end:

```
1. A page calls a service          ExamService.publishExam(id)
2. The service calls the API       POST /api/exams/:id/publish
                                   Authorization: Bearer <JWT>
3. authenticate middleware         verifies the token signature, loads the
                                   user from the DB (so a deleted account
                                   cannot act on a live token)
4. requireRole('teacher')          rejects students with 403
5. validate(idParamSchema)         rejects a malformed id with 400
6. examController.publish          translates HTTP to a service call
7. ExamService.changeStatus        checks ownership, checks the state machine
8. ExamRepository.updateStatus     the only layer that writes SQL
9. PostgreSQL                      CHECK constraint is the final backstop
                                   ── response travels back up ──
10. errorHandler                   if anything threw, turns it into JSON
                                   without leaking SQL or a stack trace
```

Every layer has one job, and the layer below never trusts the layer above.

## 4. Where the rules live, and why

Milestone 1 enforced its rules in the browser. That is not enforcement — a
client can be edited, or bypassed entirely with `curl`. Milestone 2 moved every
one of them to the server:

| Rule | Enforced in |
|---|---|
| Exam lifecycle: Draft → Published → Closed | `Exam.canTransitionTo()` + a database CHECK |
| One submission per student per exam | A database UNIQUE constraint |
| Only the owning teacher may edit or grade | `ExamService`, on every write |
| Students see published exams only | `ExamService.list()` / `.get()` |
| **Students never receive the answer key** | `Question.toJSON()` omits it by default |
| A grade is invisible until published | `Submission.toJSON({ forStudent })` |
| The exam timer | `SubmissionService`, against a stored `expires_at` |
| Multiple choice is marked from the key | `services/grading.js`, never the model |

Two of these deserve emphasis because they are security properties, not
features:

**The answer key** is stripped in the model layer, not the controller. A new
endpoint that returns an exam gets the safe behaviour by default and has to opt
in to the unsafe one — the opposite of the usual arrangement, where forgetting
is what causes the leak.

**An unpublished grade** is not merely hidden: the submission's *status* is
collapsed from `ai_graded` to `submitted` for students, so they cannot tell
that a draft grade exists at all.

## 5. Three decisions worth explaining

### Questions are normalised, answers are rows

An earlier draft stored an exam's questions as a JSONB blob. They became their
own table because per-question analytics — "which question did the class find
hardest?" — is a plain SQL join over `questions` and `answers`, and JSON
traversal for the same result is both slower and far harder to read.

The cost is that saving an exam is more complicated. See below.

### A submission exists from the moment the exam is opened

The row is created when a student *starts* an exam, not when they submit. That
single decision gives three features for free:

- the timer has somewhere to live (`started_at`, `expires_at`)
- autosaved answers have somewhere to go
- the existing UNIQUE constraint prevents a second attempt

`expires_at` is stamped at that moment, so changing an exam's duration later
cannot move a deadline that is already running.

### Saving an exam reconciles, it does not replace

`PUT /api/exams/:id` receives the whole exam, which is what the editor
naturally produces. The repository then **diffs** it against what is stored:

| Incoming question | Action |
|---|---|
| Has an id that exists | `UPDATE` in place — the id survives |
| Has no id | `INSERT` |
| Stored but absent from the payload | `DELETE` |

The naive implementation — delete all, insert all — would give every question a
new id. Because `answers.question_id` references `questions(id)` with
`ON DELETE CASCADE`, fixing a typo in a live exam would silently destroy every
student's answers.

Because the server compares old against new, it also knows *what* changed, so
the "3 students have already submitted — their grades need re-running" warning
falls out of the same comparison rather than needing separate bookkeeping.

## 6. The AI service

Three features: generating an exam from a description, grading open-text
answers, and writing a narrative over the analytics figures.

```
AiService                      business logic; validates everything
  │
  ├── ModelBackedProvider      implements all three tasks by prompting
  │     └── NimProvider        supplies only complete()
  │
  └── FallbackProvider         implements all three deterministically
```

The provider interface is **task-level** (`generateExam`, `gradeAnswers`,
`summariseAnalytics`) rather than prompt-level. A prompt-level interface would
force the fallback to pretend to be a language model; a task-level one lets it
satisfy the same contract with ordinary code.

**Nothing generated is trusted.** A model's output is untrusted input:
`AiService` validates the shape, repairs what is safely repairable (weights
that do not total 100), and rejects what is not (a multiple-choice question
with one option) — because a malformed question would otherwise reach the
database and surface as a constraint violation rather than a handled error.

**Nothing generated is saved automatically.** Exam generation returns a draft
for the teacher to review. This is not caution for its own sake: during testing
the model produced a confident, plausible, *wrong* answer key three times.

**Two models, not one.** Grading runs on `kimi-k3`, a reasoning model that
thinks before answering; generation and the analytics summary run on
`llama-3.1-70b`. The split came from measurement, not preference — the same
5-question generation took 32.7s on `kimi-k3` and 14.1s on `llama-3.1-70b`,
and drafting questions does not need the reasoning that catches a student's
invalid working. Generation went from 33s to 11.4s and the analytics summary
from 33s to 5.4s. Grading kept the slower model because it is clicked once per
submission and is the one task where being wrong matters.

(`llama-3.3-70b` was measured too, and rejected: at 53.7s it is slower than
`kimi-k3`. Newer is not faster.)

**Multiple choice never reaches the model.** It is decided by the answer key in
code, so a twelve-question exam with two open questions costs one API call
rather than twelve — and multiple-choice marking can never be inconsistent.

**Every call degrades rather than fails.** Provider unreachable, model retired,
unparseable reply, output that fails validation — each falls through to the
deterministic provider. The response always reports which provider answered and
whether a real model was involved, so the interface can label it honestly
instead of implying intelligence that was not there.

### Running with no API key

Every AI feature works without one. Exams are generated from templates built
around the teacher's own words; open-text answers are scored by comparing them
against the question's vocabulary. It is visibly less capable, and says so in
its own feedback, but it is a real implementation rather than a stub.

This exists so the project runs for someone who is not its author. An
application whose headline features are dead on an examiner's machine has not
really shipped them.

## 7. Technology, and why

| Layer | Choice | Reason |
|---|---|---|
| Client | React 19 + Vite | Carried over from Milestone 1 |
| Routing | react-router 7 | Carried over |
| Server | Express 5 | Small, explicit, no framework conventions to explain |
| Database | PostgreSQL | CHECK constraints, JSONB where it helps, real referential integrity |
| Auth | JWT + bcrypt | Stateless auth; no session store to run |
| Validation | zod | Schemas that are readable as documentation |
| AI | NVIDIA NIM | Free tier, OpenAI-compatible, so the adapter is a thin `fetch` |
| Tests | Vitest + supertest | Same runner both halves; supertest drives the real app |

## 8. Deployment

The application runs locally by design (decision D2) — it is not hosted
anywhere and has no public URL. `docker compose up` starts the client, the API
and PostgreSQL together.

The database is the one component that is hosted: a managed PostgreSQL 16
instance on Render. Pointing the API at it — or back at a local PostgreSQL — is
a change to `DATABASE_URL` alone, with no code change.

See `docs/PROCESS.md` for configuration, running, testing and logging.
