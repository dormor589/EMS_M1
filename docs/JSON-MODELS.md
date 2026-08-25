# JSON Models

The shapes the API sends and accepts. These correspond one-to-one with the five
database tables and the five entity classes — see `diagrams/erd.png` and
`diagrams/class-diagram.png`.

Two conventions throughout:

- The database uses `snake_case`; the API uses `camelCase`. The models do the
  translation, so no SQL naming leaks into the client.
- `NUMERIC` columns arrive from the driver as strings and are converted to
  numbers by the models, so `grade` is `88` in JSON, not `"88.00"`.

---

## User

Returned by `/api/auth/*` and embedded in a teacher's view of a submission.

```json
{
  "id": "a1b2c3d4-0001-4000-8000-000000000001",
  "name": "Alice Teacher",
  "email": "teacher@ems.dev",
  "role": "teacher",
  "createdAt": "2026-08-23T10:00:00.000Z"
}
```

**There is no password field, in any response, ever.** The bcrypt hash lives in
the database and is reachable only by `AuthService` when verifying a login.

Login and registration additionally return a token:

```json
{
  "user": { "...": "as above" },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

---

## Exam

### As a teacher sees it

```json
{
  "id": "5b3e7a6a-78e1-4cd1-b799-00aa8f90e003",
  "title": "Introduction to Web Development",
  "description": "HTML, CSS and JavaScript basics.",
  "durationMinutes": 30,
  "passingGrade": 60,
  "status": "Published",
  "createdBy": "a1b2c3d4-0001-4000-8000-000000000001",
  "generatedByAi": false,
  "aiPrompt": null,
  "questions": [ "...see Question below..." ],
  "questionCount": 3,
  "totalWeight": 100,
  "createdAt": "2026-08-23T10:00:00.000Z",
  "updatedAt": "2026-08-23T10:00:00.000Z"
}
```

`questionCount` and `totalWeight` are derived, not stored — the model computes
them so the UI does not have to.

### As a student sees it

Identical, **except that every question omits `correctAnswer`.** See below.

---

## Question

### To a teacher (owner)

```json
{
  "id": "a2e4e4d8-b597-4dfa-a788-3ec1f6b2c20f",
  "examId": "5b3e7a6a-78e1-4cd1-b799-00aa8f90e003",
  "type": "multiple-choice",
  "text": "Which language is used for styling web pages?",
  "options": ["HTML", "CSS", "JavaScript", "Python"],
  "correctAnswer": 1,
  "weight": 30,
  "position": 0
}
```

### To a student

```json
{
  "id": "a2e4e4d8-b597-4dfa-a788-3ec1f6b2c20f",
  "examId": "5b3e7a6a-78e1-4cd1-b799-00aa8f90e003",
  "type": "multiple-choice",
  "text": "Which language is used for styling web pages?",
  "options": ["HTML", "CSS", "JavaScript", "Python"],
  "weight": 30,
  "position": 0
}
```

**The key is absent, not null.** `Question.toJSON()` omits it unless the caller
explicitly asks, so a new endpoint returning an exam is safe by default and has
to opt in to the unsafe behaviour.

An open-text question has `"options": []` and, for a teacher,
`"correctAnswer": null`.

---

## Submission

### To the owning teacher

```json
{
  "id": "e811f403-2e33-4c39-a63d-28bc2017fd78",
  "examId": "5b3e7a6a-78e1-4cd1-b799-00aa8f90e003",
  "studentId": "a1b2c3d4-0002-4000-8000-000000000002",
  "status": "ai_graded",
  "startedAt": "2026-08-23T11:00:00.000Z",
  "expiresAt": "2026-08-23T11:30:00.000Z",
  "submittedAt": "2026-08-23T11:26:00.000Z",
  "secondsRemaining": 0,
  "grade": 88,
  "feedback": "Good work overall.",
  "gradedBy": "ai+teacher",
  "gradedAt": null,
  "needsRegrade": false,
  "passed": true,
  "answers": [ "...see Answer below..." ],
  "student": { "...User..." },
  "exam": { "...Exam, WITH the answer key..." }
}
```

`gradedAt` is `null` while the grade is a draft. It is set only when the grade
is published, which is also what the database CHECK constraint enforces.

### To the student who wrote it, before publication

```json
{
  "id": "e811f403-2e33-4c39-a63d-28bc2017fd78",
  "examId": "5b3e7a6a-78e1-4cd1-b799-00aa8f90e003",
  "studentId": "a1b2c3d4-0002-4000-8000-000000000002",
  "status": "submitted",
  "startedAt": "2026-08-23T11:00:00.000Z",
  "expiresAt": "2026-08-23T11:30:00.000Z",
  "submittedAt": "2026-08-23T11:26:00.000Z",
  "secondsRemaining": 0,
  "grade": null,
  "feedback": "",
  "passed": null,
  "answers": [
    { "id": "...", "questionId": "...", "value": "their answer", "isCorrect": null }
  ]
}
```

Three things are deliberately different:

1. `grade` and `feedback` are emptied.
2. **`status` reads `submitted`, not `ai_graded`** — collapsed, so the student
   cannot infer that a draft grade exists.
3. Each answer is stripped of `score`, `aiScore`, `feedback` and `aiFeedback`.

Once published, `status` becomes `graded` and the full record is returned.

---

## Answer

### To a teacher

```json
{
  "id": "f3bee279-cfbb-490e-930c-1bbc98b1dfa1",
  "submissionId": "e811f403-2e33-4c39-a63d-28bc2017fd78",
  "questionId": "a2e4e4d8-b597-4dfa-a788-3ec1f6b2c20f",
  "value": "1",
  "isCorrect": true,
  "aiScore": 75,
  "aiFeedback": "Correct on the syntax, but the specificity rule is not mentioned.",
  "score": 92,
  "feedback": "You did cover specificity — raised.",
  "wasOverridden": true,
  "updatedAt": "2026-08-23T11:26:00.000Z"
}
```

`value` is the **option index as text** for multiple choice, and the prose for
open text. One column, because the question on the other side of `questionId`
already says how to read it.

The `ai*` fields hold what the model proposed; `score` and `feedback` hold what
the teacher settled on. Keeping both is what lets the UI say *"AI proposed 75 —
you changed it to 92"* rather than silently overwriting the model's judgement.
`wasOverridden` is derived from the two.

---

## Requests

### Create or update an exam

`PUT` sends the whole exam. A question **with** an `id` is updated in place; a
question **without** one is inserted; a stored question absent from the array is
deleted. Keeping ids is what stops existing answers being cascade-deleted.

```json
{
  "title": "Introduction to Web Development",
  "description": "HTML, CSS and JavaScript basics.",
  "durationMinutes": 30,
  "passingGrade": 60,
  "questions": [
    {
      "id": "a2e4e4d8-b597-4dfa-a788-3ec1f6b2c20f",
      "type": "multiple-choice",
      "text": "Which language is used for styling web pages?",
      "options": ["HTML", "CSS", "JavaScript", "Python"],
      "correctAnswer": 1,
      "weight": 30
    },
    {
      "type": "open-text",
      "text": "Explain the CSS box model.",
      "options": [],
      "correctAnswer": null,
      "weight": 70
    }
  ]
}
```

Response:

```json
{ "exam": { "...": "..." }, "regradeRequired": 0 }
```

`regradeRequired` counts submissions the edit invalidated — non-zero when the
correct answer, a weight, or the question set changed.

### Autosave

```json
{ "answers": [ { "questionId": "a2e4...", "value": "1" } ] }
```

### Submit

```json
{ "auto": false }
```

`auto: true` means the client's countdown fired rather than the student
clicking. The server accepts those past the deadline, because the answers were
captured before expiry.

### Grade

```json
{
  "answers": [ { "questionId": "f3be...", "score": 92, "feedback": "Well argued." } ],
  "feedback": "Strong overall.",
  "publish": false
}
```

A `score` sent for a multiple-choice question is ignored — the answer key
decides, so a teacher cannot accidentally mark a correct answer wrong.

### Generate an exam with AI

```json
{ "description": "Intro to React hooks, mixed difficulty", "questionCount": 8 }
```

Response — **not saved**, returned for review:

```json
{
  "exam": { "...Exam...", "generatedByAi": true, "aiPrompt": "Intro to React hooks..." },
  "generatedBy": "nim:moonshotai/kimi-k3",
  "modelBacked": true
}
```

`modelBacked: false` means the deterministic fallback answered, so the UI can
label it honestly rather than implying a model was involved.

---

## Errors

Every error is JSON with the same shape:

```json
{ "error": "This exam belongs to another teacher" }
```

Validation failures add field detail:

```json
{
  "error": "Some fields need fixing",
  "details": {
    "fields": [
      { "field": "questions.0.options", "message": "A multiple-choice question needs at least two options" }
    ]
  }
}
```

| Status | Meaning |
|---|---|
| 400 | Malformed request; `details.fields` says which |
| 401 | Missing, invalid or expired token |
| 403 | Authenticated, but not allowed — wrong role, or another teacher's exam |
| 404 | Absent **or not visible to you** — the two are deliberately indistinguishable |
| 409 | Conflicts with current state — duplicate submission, illegal transition, expired timer |
| 422 | Well-formed but unacceptable — e.g. publishing an exam with no questions |
| 500 | Unexpected fault. Logged in full server-side; the response carries no detail |
