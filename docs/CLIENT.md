# Client Architecture

React 19 single-page application, built with Vite. Runs on **:5173**.

---

## 1. Packages

### Runtime

| Package | Why |
|---|---|
| `react` 19 | UI |
| `react-dom` 19 | DOM renderer |
| `react-router-dom` 7 | Client-side routing and route guards |

Deliberately small. There is no state-management library, no HTTP client, no
component framework and no CSS framework: the service layer covers state,
`fetch` covers HTTP, and the styling is hand-written. Each of those would have
been a dependency to justify, and none was needed at this size.

The only external asset is the type, loaded from Google Fonts in `index.html`:

| Face | Used for |
|---|---|
| **Spectral** (serif) | Page titles, stat numerals, and exam question text — so questions read like a printed paper |
| **IBM Plex Sans** | Interface text |
| **IBM Plex Mono** | The countdown, identifiers, table headers and data labels |

Every face declares a real fallback stack, so a blocked font request degrades
rather than breaking the layout.

### Development

| Package | Why |
|---|---|
| `vite` 8 + `@vitejs/plugin-react` | Dev server and production build |
| `vitest` + `jsdom` | Test runner and DOM environment |
| `@testing-library/react` + `/jest-dom` + `/user-event` | Component tests that exercise the UI as a user would |
| `eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh` | Linting |

## 2. Layers

```
pages/           screens. Read from services, render, handle events.
                 No business logic, no fetch calls.
      │
components/      layout shell and route guards, shared across pages
      │
services/        all logic and all I/O. The only layer that knows
                 the API exists.
      │
models/          pure entity classes. No imports from services.
```

The rule that keeps this honest: **a page never calls `fetch`, and a model
never imports a service.** Everything crossing the network goes through
`HttpApiService`, which is why swapping Milestone 1's `localStorage` backend
for a real API changed four lines in `services/index.js` and left the pages
almost untouched.

## 3. Services

Instantiated once in `services/index.js`, which is the dependency-injection
root. Application code imports from there, never from the individual files.

| Service | Responsibility |
|---|---|
| `ConfigService` | Every constant and magic string. API base URL, storage keys, roles, statuses |
| `LoggerService` | The only code permitted to call `console` |
| `StorageService` | The only code permitted to touch `localStorage` |
| `NotifyService` | User-facing success and error messages |
| **`HttpApiService`** | The persistence seam. Attaches the JWT, unwraps responses, turns errors into readable messages |
| `AuthService` | Login, register, logout, role checks |
| `ExamService` | Exam CRUD and the publish/close transitions |
| `SubmissionService` | Attempts, autosave, submission, grading |
| `AiService` | Exam generation and AI grading |
| `AnalyticsService` | Statistics |

Wiring, with no cycles:

```
config, logger                        (no dependencies)
  └─▶ storage, notify                 (logger)
        └─▶ api                       (config, logger, storage)
              ├─▶ auth                (api, storage, config, logger)
              ├─▶ examService         (api, config, logger)
              ├─▶ submissionService   (api, examService, config, logger)
              ├─▶ aiService           (api, logger)
              └─▶ analyticsService    (api, logger)
```

### Why `getCurrentUser()` is synchronous

`ProtectedRoute` and `NavigationMenu` need the current user *during render*, so
it cannot be a promise. `AuthService` caches the public user record in storage
at login and reads it synchronously; the token is re-validated against the
server once at boot, not on every render.

## 4. Component hierarchy

```
App                                     app/App.jsx
│  Checks the API is reachable before rendering anything.
│  Re-validates the stored session (a token can expire while the tab is closed).
│  Shows an actionable message if the server is down.
│
└── BrowserRouter
    └── AppRoutes                       app/routes.jsx
        └── MainLayout                  components/layout/MainLayout.jsx
            ├── NavigationMenu          role-aware; reads auth during render
            └── <Outlet>
                │
                ├── LoginPage           pages/auth/
                ├── RegisterPage
                │
                ├── ProtectedRoute role="teacher"
                │   ├── TeacherDashboard        pages/teacher/
                │   ├── TeacherExamsPage        list, publish, close
                │   ├── CreateExamPage          question editor
                │   ├── EditExamPage            same editor, pre-filled
                │   ├── GenerateExamPage        ✨ AI: describe → draft → review
                │   ├── SubmissionsPage         grouped by exam
                │   ├── SubmissionDetailPage    marking screen, AI grading, publish
                │   └── AnalyticsPage           distribution, per-question difficulty
                │
                ├── ProtectedRoute role="student"
                │   ├── StudentDashboard        pages/student/
                │   ├── AvailableExamsPage      published, not yet submitted
                │   ├── TakeExamPage            countdown, autosave
                │   └── GradesPage              published grades only
                │
                └── NotFoundPage
```

`ProtectedRoute` redirects an unauthenticated visitor to `/login`, and a user
with the wrong role to their own dashboard. It is a convenience, not a security
boundary — the server refuses the request regardless.

## 5. Two pages worth describing

### TakeExamPage

The most stateful screen in the application.

- Opening it **starts or resumes** an attempt. The server fixes the deadline, so
  refreshing cannot buy more time.
- Answers **autosave to the server**, debounced 1.2s. Closing the tab loses
  nothing, and a draft follows the student to another machine.
- A **countdown** runs against the server's `expires_at` and submits
  automatically at zero. The server accepts that submission even though it
  arrives late, because the answers were captured before expiry.
- Multiple-choice answers are stored as the **option index**, which is what the
  server marks against.

The attempt id and deadline live in refs rather than state: they are read by
callbacks and never rendered, so putting them in state would re-render for
nothing.

### SubmissionDetailPage

The marking screen.

- Multiple choice is shown **read-only** — it is marked from the answer key, so
  a teacher cannot accidentally mark a correct answer wrong.
- Open-text questions get an editable score and comment.
- Where the AI has run, its proposal is shown **beside** the teacher's value:
  *"AI proposed 20/100 — you changed it to 55."*
- The total recomputes live using the same formula as the server.
- **Save draft** keeps it private; **Publish** releases it to the student.

## 6. Configuration

Vite exposes only `VITE_*` variables, and inlines them at build time.

| Variable | Default | Notes |
|---|---|---|
| `VITE_API_URL` | `http://localhost:5050/api` | Baked into the bundle at build time, so it cannot be changed by setting an env var on a running container |

Port 5050 rather than 5000 because macOS AirPlay Receiver occupies 5000 and
silently intercepts the connection — Node binds successfully and every request
still fails.

## 7. Visual design

The interface is styled entirely in three hand-written stylesheets
(`index.css`, `styles/layout.css`, `styles/pages.css`) driven by CSS custom
properties, with no framework and no runtime styling library.

**Identity** — Oxford navy over slate-washed paper, with brass as the accent: a
diamond seal after the wordmark, and a hairline under every page title tipped
with a short brass bar.

**Violet is reserved exclusively for AI surfaces** — the ✨ generate and grading
buttons, the "AI proposed N/100" note, the provider badge. This makes the
system's honesty semantic visible: if it is violet, a model was involved.

**Three grounds**, each scoped with `body:has()` and a page modifier class, so
the theme changes without any JavaScript:

| Page | Ground |
|---|---|
| Default | Slate paper, faint ledger grid, grain, light from the top |
| Sitting an exam | Warm cream with laid-paper lines, no grid — calm, like a printed sheet |
| Analytics | A dark instrument panel — deep ink, blue-lit grid, glowing chart bars |

The dark treatment is deliberately scoped to one page rather than offered as a
global dark mode, which would have needed the same care across every screen to
avoid looking unfinished.

**Motion** — page and list entrances, staggered table rows, histogram bars
growing from the baseline, the countdown pulsing an expanding ring below 60
seconds, and a sheen sweep on AI buttons. All of it sits inside a
`@media (prefers-reduced-motion: reduce)` guard that neutralises every
animation and transition.

## 8. Testing

`npm test` — 151 tests.

Service tests use a `fakeApi` double that records calls and replays canned
responses, so they assert the HTTP contract (right verb, right path, right
body) without a server or a database.
