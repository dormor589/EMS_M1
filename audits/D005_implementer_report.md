# D005 — Implementer Report

**Date:** 2026-05-23T23:31:00Z
**Status:** Submitted for QA review

---

## What was built

| File | Lines | Notes |
|------|-------|-------|
| `client/src/components/layout/MainLayout.jsx` | 30 | Shell: NavigationMenu + Outlet |
| `client/src/components/layout/NavigationMenu.jsx` | 105 | Role-aware nav; re-reads on location change |
| `client/src/components/shared/ProtectedRoute.jsx` | 40 | Route guard |
| `client/src/styles/layout.css` | 100 | Nav + layout styles, responsive |
| `client/src/app/routes.jsx` | 113 | Full route tree (replaced D004 minimal) |
| `client/src/app/App.jsx` | 40 | Simplified: BrowserRouter + seed + AppRoutes |
| `client/src/pages/NotFoundPage.jsx` | 24 | 404 catch-all |
| `client/src/test-setup.js` | 4 | jest-dom import |
| `client/vitest.config.js` | 13 | Updated: .jsx support + setupFiles |
| `client/src/components/layout/__tests__/NavigationMenu.test.jsx` | 128 | 14 tests |
| `client/src/components/shared/__tests__/ProtectedRoute.test.jsx` | 95 | 8 tests |

---

## Tests

```
 RUN  v4.1.7

 Test Files  9 passed (9)
      Tests  150 passed (150)
   Start at  23:27:35
   Duration  1.36s
```

| File | Tests | Result |
|------|-------|--------|
| ConfigService.test.js | 13 | ✅ PASS |
| LoggerService.test.js | 13 | ✅ PASS |
| StorageService.test.js | 14 | ✅ PASS |
| NotifyService.test.js | 11 | ✅ PASS |
| models.test.js | 35 | ✅ PASS |
| MockApiService.test.js | 22 | ✅ PASS |
| AuthService.test.js | 20 | ✅ PASS |
| NavigationMenu.test.jsx | 14 | ✅ PASS |
| ProtectedRoute.test.jsx | 8 | ✅ PASS |
| **Total** | **150** | **✅ ALL PASS** |

- New tests this D-task: 22 (14 NavigationMenu + 8 ProtectedRoute)
- Cumulative: 150/150 PASS — exceeds ≥32 cumulative requirement ✅

---

## R14 sanity result

**N/A for M1.**

---

## Performance benchmarks

- Vitest: 1.36s (9 test files incl. React component rendering)
- Build: 83ms, 51 modules

---

## Acceptance criteria verification

| Criterion | Verified by | Result |
|-----------|-------------|--------|
| Nav differs by role | NavigationMenu tests (14 assertions per state) | ✅ |
| `/teacher/exams` as student → `/student` | ProtectedRoute test: "redirects student trying teacher route" | ✅ |
| Unauthenticated `/teacher/exams` → `/login` | ProtectedRoute test: "redirects to /login with role requirement + no user" | ✅ |
| `/` as teacher → `/teacher` | LandingRedirect logic (teacher branch) | ✅ |
| `/` as student → `/student` | LandingRedirect logic (student branch) | ✅ |
| Logout from nav → `/login` | NavigationMenu.handleLogout: auth.logout() + navigate('/login') | ✅ |
| All teacher pages reachable | Route tree: /teacher, /teacher/exams, /teacher/exams/new, /teacher/exams/:id/edit, /teacher/submissions | ✅ |
| All student pages reachable | Route tree: /student, /student/exams, /student/exams/:id, /student/grades | ✅ |

---

## Grep constraint verification

### localStorage — StorageService.js ONLY ✅

Zero `localStorage.` calls in any new file. All new components and routes read auth state via `auth.getCurrentUser()` (which goes through StorageService).

### console.* — LoggerService.js ONLY ✅

Zero `console.*` calls in any new file. NavigationMenu and ProtectedRoute use no logging.

---

## Architecture

### Auth state propagation — why no Context

NavigationMenu re-reads `auth.getCurrentUser()` via `useEffect([location.pathname])`. This means every navigation event (login → navigate('/'), logout → navigate('/login')) triggers a state refresh in the nav. This avoids React Context boilerplate while still being reactive.

ProtectedRoute calls `auth.getCurrentUser()` on each render (synchronous from StorageService). Because ProtectedRoute is re-mounted on route changes, this is always fresh.

This is intentionally simple for M1. M2 can introduce a proper `AuthContext` if global auth state becomes more complex.

### Route tree structure

```
BrowserRouter
└── Routes
    └── <MainLayout>  (Outlet renders the matched child)
        ├── /                   → LandingRedirect (no content; immediately redirects)
        ├── /login              → LoginPage (unguarded)
        ├── /register           → RegisterPage (unguarded)
        ├── /teacher            → ProtectedRoute role="teacher" → TeacherDashboard
        ├── /teacher/exams      → ProtectedRoute role="teacher" → TeacherExamsPage
        ├── /teacher/exams/new  → ProtectedRoute role="teacher" → CreateExamPage
        ├── /teacher/exams/:id/edit → ProtectedRoute role="teacher" → EditExamPage
        ├── /teacher/submissions → ProtectedRoute role="teacher" → SubmissionsPage
        ├── /student            → ProtectedRoute role="student" → StudentDashboard
        ├── /student/exams      → ProtectedRoute role="student" → AvailableExamsPage
        ├── /student/exams/:id  → ProtectedRoute role="student" → TakeExamPage
        ├── /student/grades     → ProtectedRoute role="student" → GradesPage
        └── *                  → NotFoundPage
```

All teacher/student pages are still D001 placeholders (render `<h1>PageName</h1>`). D006 fills teacher pages, D007 fills student pages.

### NavigationMenu design

Sub-components `UnauthLinks`, `TeacherLinks`, `StudentLinks` keep the render logic clean. Each is a pure component that receives `user` and `onLogout`. No business logic in any component — `auth.logout()` is the only service call and it's in the handler, not inline JSX.

---

## Code complexity

- New production lines: ~460 (layout + routes + nav + guard + styles)
- New test lines: ~223
- Cyclomatic complexity worst function: 3 (`LandingRedirect` — 2 branches; `ProtectedRoute` — 2 branches)
- Number of TODO/FIXME: 0

---

## Self-review checklist

- [x] Nav visibly differs by role (tested + CSS styling)
- [x] `/teacher/exams` as student → `/student` ✅ tested
- [x] Unauthenticated → `/login` ✅ tested
- [x] Teacher login → `/teacher` ✅ LandingRedirect logic
- [x] Student login → `/student` ✅ LandingRedirect logic
- [x] Logout clears state + navigates to `/login` ✅
- [x] All teacher + student placeholder pages reachable via route tree
- [x] 150/150 tests pass; ≥32 cumulative ✅
- [x] localStorage only in StorageService ✅ grep clean
- [x] console.* only in LoggerService ✅ grep clean
- [x] Build passes (83ms)
- [x] ≥6 conventional commits (7 commits)
- [x] No TODO/FIXME

---

## Commits produced on `dev`

| SHA | Message |
|-----|---------|
| 421cdf9 | `feat: add MainLayout shell with Outlet` |
| a2c2011 | `feat: add role-based NavigationMenu` |
| e0a3a85 | `feat: add ProtectedRoute route guard` |
| ace95a4 | `feat: wire role-aware route tree in routes.jsx` |
| 5f04f44 | `style: add minimal layout styling` |
| 0c30ec2 | `test: add tests for NavigationMenu and ProtectedRoute` |
| d5a4174 | `docs: update ai-work-log with D005 entry` |

---

## Follow-up questions for Team Lead

1. **(NavigationMenu auth re-read on location change)** — NavigationMenu reads `auth.getCurrentUser()` via `useEffect([location.pathname])`. This means it re-reads on every navigation. If D006/D007 introduce programmatic state changes that don't involve navigation (unlikely in M1), the nav won't update. For M1, this is acceptable. If a proper `AuthContext` is needed, it can be introduced in M2.

2. **(Placeholder pages still show `<h1>PageName</h1>`)** — D006 fills teacher pages, D007 fills student pages. All 9 are reachable via the route tree and render without errors. Ready for content.

3. **(react-router NavLink "active" class)** — `NavLink` from react-router-dom v7 automatically adds an `active` class to the matching link. The `layout.css` has `.ems-nav__link.active` styled. This works correctly in v7 (confirmed by NavLink API).
