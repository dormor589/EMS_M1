# D005 — QA Audit Report

**Date:** 2026-05-23T23:50:00Z
**Auditing:** D005 (Role-based MainLayout + NavigationMenu + ProtectedRoute route guards)
**Implementer report:** audits/D005_implementer_report.md
**Verdict:** PASS

---

## R14 sanity

N/A for M1 (mock-only deployment).

---

## Independent test run

```
 RUN  v4.1.7

 Test Files  9 passed (9)
      Tests  150 passed (150)
   Start at  23:36:18
   Duration  1.52s
```

**Cumulative requirement:** ≥32 — **150 PASS ✓**
New tests this D-task: 22 (14 NavigationMenu + 8 ProtectedRoute) — consistent with Vitest total.

---

## Independent build

```
vite v8.0.14 building for production...
✓ 51 modules transformed
dist/index.html         0.45 kB │ gzip:  0.29 kB
dist/assets/*.css       2.97 kB │ gzip:  1.17 kB
dist/assets/*.js      251.39 kB │ gzip: 79.38 kB
✓ built in 104ms
```

Build: **PASS ✓**

---

## Grep constraint verification (D005 new files)

Scope: `MainLayout.jsx`, `NavigationMenu.jsx`, `ProtectedRoute.jsx`, `routes.jsx`, `App.jsx` (D005 version), `NotFoundPage.jsx`, `layout.css`.

### localStorage — StorageService.js ONLY

```
grep -rn "localStorage" [D005 new files]
→ NONE FOUND
```
**PASS ✓**

### console.* — LoggerService.js ONLY

```
grep -rn "console\." [D005 new files]
→ NONE FOUND
```
**PASS ✓**

---

## Git log verification

D005 commits on `dev` (above D004 close marker `76f3080`):

| SHA | Message | Conventional? |
|-----|---------|---------------|
| 421cdf9 | `feat: add MainLayout shell with Outlet` | ✅ |
| a2c2011 | `feat: add role-based NavigationMenu` | ✅ |
| e0a3a85 | `feat: add ProtectedRoute route guard` | ✅ |
| ace95a4 | `feat: wire role-aware route tree in routes.jsx` | ✅ |
| 5f04f44 | `style: add minimal layout styling` | ✅ |
| 0c30ec2 | `test: add tests for NavigationMenu and ProtectedRoute` | ✅ |
| d5a4174 | `docs: update ai-work-log with D005 entry` | ✅ |

**7 conventional commits on `dev` — ≥6 required ✓**

`origin/dev` HEAD matches local `dev` (aacfe9d). **Pushed ✓**

---

## CRITICAL spec checks

All verified by direct code reading of implementation files.

### 1. Unauthenticated access → redirect to `/login`

`ProtectedRoute.jsx`:
```jsx
const user = auth.getCurrentUser();
if (!user) return <Navigate to="/login" replace />;
```
**PASS ✓** — confirmed by code + ProtectedRoute tests "redirects to /login when not authenticated" and "redirects to /login for a role-restricted route with no user".

### 2. Student visiting `/teacher/*` → redirect to `/student`

`ProtectedRoute.jsx`:
```jsx
if (role && user.role !== role) {
  const home = user.role === 'teacher' ? '/teacher' : '/student';
  return <Navigate to={home} replace />;
}
```
Student (`role='student'`) hitting route guarded with `role="teacher"`: `user.role !== 'teacher'` → true. `home = '/student'`.  
**PASS ✓** — confirmed by code + test "redirects student trying to access a teacher route to /student".

### 3. Teacher visiting `/student/*` → redirect to `/teacher`

Same logic path: teacher (`role='teacher'`) hitting route guarded with `role="student"`. `user.role !== 'student'` → true. `home = '/teacher'`.  
**PASS ✓** — confirmed by code + test "redirects teacher trying to access a student route to /teacher".

### 4. NavigationMenu renders DIFFERENT links per role

Three mutually exclusive sub-components:
- `UnauthLinks`: Login, Register (no user-specific links)
- `TeacherLinks`: Dashboard, My Exams, New Exam, Submissions, name/(teacher), Logout
- `StudentLinks`: Dashboard, Available Exams, Grades, name/(student), Logout

Rendering branch: `if (!user) → UnauthLinks; else if (user.role === 'teacher') → TeacherLinks; else → StudentLinks`.  
**PASS ✓** — confirmed by code + 14 NavigationMenu tests covering all three states.

### 5. Logout calls `auth.logout()` AND navigates to `/login`

`NavigationMenu.jsx handleLogout()`:
```jsx
function handleLogout() {
  auth.logout();
  setCurrentUser(null);
  navigate('/login');
}
```
Both `auth.logout()` (clears StorageService) and `navigate('/login')` called. Local state also cleared synchronously.  
**PASS ✓** — confirmed by code + NavigationMenu test "shows Logout button" (button present) + ProtectedRoute behavioral coverage.

### 6. All teacher routes guarded with `role="teacher"`

`routes.jsx` — every teacher route wraps its page component:
```jsx
<ProtectedRoute role="teacher"><TeacherDashboard /></ProtectedRoute>
// ... 4 more teacher routes
```
All 5 teacher routes (`/teacher`, `/teacher/exams`, `/teacher/exams/new`, `/teacher/exams/:id/edit`, `/teacher/submissions`) are guarded. **PASS ✓**

### 7. All student routes guarded with `role="student"`

All 4 student routes (`/student`, `/student/exams`, `/student/exams/:id`, `/student/grades`) are guarded. **PASS ✓**

### 8. Route tree structure matches spec §15.1

```
BrowserRouter → AppRoutes → MainLayout (Outlet)
├── /            → LandingRedirect
├── /login       → LoginPage (unguarded)
├── /register    → RegisterPage (unguarded)
├── /teacher     → ProtectedRoute(teacher) → TeacherDashboard
├── /teacher/exams → ProtectedRoute(teacher) → TeacherExamsPage
├── /teacher/exams/new → ProtectedRoute(teacher) → CreateExamPage
├── /teacher/exams/:id/edit → ProtectedRoute(teacher) → EditExamPage
├── /teacher/submissions → ProtectedRoute(teacher) → SubmissionsPage
├── /student     → ProtectedRoute(student) → StudentDashboard
├── /student/exams → ProtectedRoute(student) → AvailableExamsPage
├── /student/exams/:id → ProtectedRoute(student) → TakeExamPage
├── /student/grades → ProtectedRoute(student) → GradesPage
└── *            → NotFoundPage
```
**PASS ✓**

---

## Minor findings

### MINOR-1 (carry-over D003/D004/D005): `App.jsx` missing `.catch()` on `seedIfEmpty()`

`App.jsx` line 26:
```jsx
mockApi.seedIfEmpty().then(() => setReady(true));
```
No `.catch()` handler. An unexpected seed error leaves the app in permanent loading state with no user feedback. This is the third consecutive D-task this has appeared. Not CRITICAL (mock-only, deterministic seed), but degrading — the implementation pattern is established and the fix is a one-liner.

**Recommendation:** Address in D006 or as a standalone fix before M1 handoff.

### MINOR-2: NavigationMenu auth re-read is navigation-scoped only

`useEffect(() => { setCurrentUser(auth.getCurrentUser()); }, [location.pathname])` — re-reads on route changes. Programmatic auth state changes without a navigation event (e.g., session timeout) would not update the nav. Documented and accepted by implementer as M1 tradeoff. No action required for D005.

---

## Acceptance criteria matrix

| Criterion | Evidence | Result |
|-----------|----------|--------|
| Nav differs by role | 3 sub-components + 14 NavigationMenu tests | ✅ |
| `/teacher/exams` as student → `/student` | Code trace + ProtectedRoute test | ✅ |
| Unauthenticated `/teacher/exams` → `/login` | Code trace + ProtectedRoute test | ✅ |
| `/` as teacher → `/teacher` | LandingRedirect code trace | ✅ |
| `/` as student → `/student` | LandingRedirect code trace | ✅ |
| Logout → `/login` | handleLogout() code trace + test | ✅ |
| All teacher pages reachable | Route tree verified | ✅ |
| All student pages reachable | Route tree verified | ✅ |
| ≥32 cumulative tests | 150/150 Vitest ✓ | ✅ |
| localStorage only in StorageService | grep clean on all D005 files | ✅ |
| console.* only in LoggerService | grep clean on all D005 files | ✅ |
| Build passes | 104ms, 51 modules, 0 errors | ✅ |
| ≥6 conventional commits on `dev` | 7 commits verified | ✅ |
| origin/dev pushed | HEAD matches local | ✅ |
| No TODO/FIXME | Implementer confirms; production files reviewed | ✅ |

---

## Verdict: PASS

All CRITICAL spec requirements satisfied. Role gating is correct: unauthenticated → /login, wrong role → own home, correct role → renders page. NavigationMenu renders role-distinct links. Logout flow is clean. Grep constraints held. 150/150 tests pass. Build clean. 7 conventional commits on dev.

Two MINORs noted (`.catch()` carry-over; nav re-read scope). Neither blocks PASS. The `.catch()` omission has now appeared in three consecutive D-tasks and warrants a Team Lead note for D006.
