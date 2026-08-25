# Milestones, Decisions and Branch Structure

What was built when, what was decided, and why.

---

## Milestone 1 — client foundation

**Branch:** `dev` · **120 commits**

A React client with a mocked persistence layer. Everything lived in
`localStorage`; the Express project existed but served only `/health`.

Delivered: role-based authentication (mock), teacher exam flow with a
Draft → Published → Closed state machine, student flow with exam-taking and a
grades page, eight OOP services with dependency injection, five entity models,
221 tests, and documentation with four diagrams.

The original Milestone 1 write-up is kept at
[`milestone-1-explanation.txt`](milestone-1-explanation.txt) as a record of
that state.

### What it deliberately did not do

Real authentication, a database, a backend, deployment, or any AI. Those were
Milestone 2, and the architecture was arranged so they could be added without
rewriting the client — a decision that paid off, described below.

---

## Milestone 2 — real backend, AI features

Developed locally, in seven stages.

| Stage | Delivered |
|---|---|
| 1 | PostgreSQL schema, 5 tables, migrations, seed, ERD |
| 2 | Express API — 16 endpoints, layered, JWT, bcrypt, validation |
| 3 | Client migrated from `localStorage` to the API |
| 4 | AI: exam generation, grading, analytics (+7 endpoints) |
| 5 | 156 server tests, Docker, CI |
| 6 | Documentation |
| 7 | Managed database, final commit |

### The migration was cheap, and that was by design

Milestone 1 routed every page through a single `MockApiService`, and every one
of its methods returned a Promise even though `localStorage` is synchronous.
That looked like over-engineering at the time. It meant the entire client moved
to a real backend by swapping one class:

```js
// Milestone 1
export const api = new MockApiService(storage, config, logger);
// Milestone 2
export const api = new HttpApiService(config, logger, storage);
```

The pages needed almost no changes. The work that remained was genuinely new
behaviour — the exam timer, server-side autosave, per-question marking — not
the swap itself.

---

## Decisions, and why

### Questions are their own table, not JSON

An early draft stored an exam's questions as a JSONB blob. They were normalised
because per-question analytics — *"which question did the class find hardest?"*
— is a plain SQL join, and JSON traversal for the same answer is slower and far
harder to read.

The cost was a more complicated save. Which led to:

### Saving an exam reconciles rather than replaces

`PUT /api/exams/:id` takes the whole exam, because that is what the editor
produces. The repository then diffs it: existing ids are `UPDATE`d in place,
new questions inserted, absent ones deleted.

The obvious implementation — delete all, insert all — gives every question a
new id. Because `answers.question_id` cascades on delete, **fixing a typo in a
live exam would have destroyed every student's answers.** The reconciling save
exists entirely to prevent that.

It also means the server knows what changed, so *"3 students have submitted —
their grades need re-running"* falls out of the same comparison.

### A submission exists from the moment the exam is opened

Not from when it is submitted. That one choice gives the timer somewhere to
live, autosaved answers somewhere to go, and reuses the existing UNIQUE
constraint to prevent a second attempt. `expires_at` is stamped then, so
changing an exam's duration later cannot move a deadline already running.

### Teachers can edit published exams

Considered locking them, and rejected it: a typo in a live exam has to be
fixable. The cost is handled rather than prevented — a grading-relevant change
flags affected submissions for re-grading and tells the teacher how many.

### Grade = Σ(score × weight) ÷ Σ(weight)

The teacher sets each question's **weight** (how much it matters); each answer
gets a **score** 0–100 (how well it was answered). Dividing by the total weight
rather than by 100 makes the weights self-normalising: a teacher can add a
question to an exam whose weights already total 100, or leave them mid-edit at
any total, and the result is still 0–100. No validation has to block a save to
keep grades sane.

It also means the model's per-question scores are independent of the weights,
so an exam can be re-weighted after grading without re-running anything.

### Grading is teacher-triggered, with a publish gate

Nothing is graded automatically. A teacher clicks, marks appear as a **draft**,
they edit anything they disagree with, then publish. Until then the student
sees nothing — and the status is collapsed from `ai_graded` to `submitted`, so
they cannot infer a draft exists.

### The AI proposes; it does not decide

Three findings from testing shaped this, all of which reached the design:

**Generated exams are never saved automatically.** The model produced a
confident, plausible, *wrong* answer key three times during testing — marking
data duplication as a property of a normalized database, and `must-revalidate`
where `no-cache` was correct. Structural validation cannot catch that; a person
can.

**Model output is untrusted input.** `AiService` validates everything, repairs
what is safely repairable, and rejects what is not — because a malformed
question would otherwise reach the database and surface as a constraint
violation rather than a handled error.

**The interface says which provider answered.** A response carries
`modelBacked`, so the UI can label template-generated content honestly instead
of implying intelligence that was not involved.

### What the AI grading testing actually found

Real answers were fed to the grader, and four defects surfaced in sequence:

| Defect | Fix |
|---|---|
| A wrong answer (`y=11` where the answer is 10) scored **100/100**, with invented reasoning: *"y = 10 + 1 = 11"* | Require `expectedAnswer` and `studentIsCorrect` as fields **before** the score |
| Working was never read — `2x = 10 + 4 = 14, x = 14 − 11 = 3` scored 100 with *"your work is correct"* | Add `methodIsSound` as a separate judgement |
| A 90 with no explanation of the ten lost marks | Feedback must name what is missing below 95 |
| An incomplete proof and a rigorous one both scored 95 | Change model |

The most useful lesson was the second attempt at the first defect: telling the
model in prose to *"verify the answer"* did not work — it then wrote *"y=11 is
not the correct solution"* **and still scored 100.** What worked was making it
commit to a verdict in a **structured field** before writing a number.

Model choice was then measured rather than assumed:

| | llama-3.3-70b | **kimi-k3** | gpt-oss-120b |
|---|---|---|---|
| Arithmetic cases | 7/7 | 6/6 | — |
| Rigorous vs incomplete proof | 5 pts — fails | **8 pts — works** | works |
| Invents criticism of a perfect answer | yes | **no** | — |
| Latency | 20–49s | **36s** | 462s — unusable |

`kimi-k3` was adopted by changing one environment variable. No code changed,
which is what the provider abstraction was for.

### Known limitation

The grader is reliable on objectively checkable things: wrong answers, invalid
working, missing working. It is **not** reliable at judging whether an
explanation is thorough enough — a correct but thinly-explained answer scores
higher than a human would give it. That judgement has no fact to check against,
and three attempts did not move it.

This is why the teacher's override exists, and it is documented rather than
hidden.

---

## Bugs worth recording

Found during development, each with a lesson:

| Bug | Cause |
|---|---|
| Every request returned nothing, though Node logged "listening" | macOS AirPlay Receiver occupies **port 5000** and wins the connection. Moved to 5050 |
| `inconsistent types deduced for parameter $1` | `$1` was both assigned to a column and compared inside a `CASE` with an untyped `NULL`. Computed in JS instead |
| Duplicate-key error when opening an exam | React's development double effect fired two attempt-creations; check-then-insert let both pass. Now `ON CONFLICT DO NOTHING` |
| The API could not reach Postgres under docker-compose | The SSL heuristic assumed "not localhost means remote". The compose host is `db`, a plain container |
| A student could distinguish a draft exam from a nonexistent one | `POST /attempt` returned 409 where `GET` returned 404. Found by writing a test |

---

## Branch structure

```
main    ──●                                    initial scaffold
           \
dev     ────●──●──●── … ──●                    Milestone 1, 126 commits
                           \
milestone-2                 ●                  Milestone 2, a single commit
                             \
dev     ──────────────────────●                merged on completion
                               \
main    ────────────────────────●              released once the work was complete
```

Milestone 1 was developed and pushed incrementally on `dev`.

Milestone 2 was developed **entirely locally** and pushed once, complete, on
`milestone-2` before merging into `dev`. That was a deliberate choice: work in
progress was not published, and the milestone appears as a coherent unit rather
than a stream of intermediate states.

The submission is on `dev`, per the course instruction. `main` was left at the
initial scaffold for the whole of development and updated only at the end, once
the project was finished — a release branch rather than a working one. `dev` and
`milestone-2` both remain, so the progression from Milestone 1 to Milestone 2
stays visible in the history.
