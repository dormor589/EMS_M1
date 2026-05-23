# D004 — QA Audit Report

**Date:** 2026-05-23T20:30:00Z
**Auditing:** D004 (AuthService + Login/Register pages + role state)
**Implementer report:** audits/D004_implementer_report.md
**Verdict:** PASS

---

## R14 sanity

**N/A for M1** — no numeric reproduction gate per OVERLAY.

---

## Spec-literal code review

Spec sources: §5.1 (Must-Have: Login/Register), §7 (User entity), §8 (AuthService).

### AuthService — all 7 methods verified

| Method | Spec §8 | Implementation | Result |
|---|---|---|---|
| `async login(email, password)` | Returns User on success; throws 'Invalid credentials' on fail | `AuthService.js:59–75` | ✓ |
| `async register({name,email,password,role})` | Creates user, returns User, auto-login | `AuthService.js:91–121` | ✓ |
| `logout()` | Clears current user from storage | `AuthService.js:126–129` | ✓ |
| `getCurrentUser()` | Returns User or null; rehydrates from storage | `AuthService.js:139–149` | ✓ |
| `isAuthenticated()` | bool | `AuthService.js:156–158` | ✓ |
| `isTeacher()` | bool | `AuthService.js:165–168` | ✓ |
| `isStudent()` | bool | `AuthService.js:175–178` | ✓ |

All 7 methods confirmed present and matching spec signatures. ✓

### AuthService — spec-literal detail checks

| Requirement | Code | Result |
|---|---|---|
| Constructor injection (mockApi, storage, config, logger) | `AuthService.js:32–44` | ✓ |
| Constructor guards for all 4 deps | Lines 33–36, each names the missing dep | ✓ |
| `currentUserKey` from ConfigService (not hardcoded) | `:43` `config.getStorageKeys().currentUser` → `'ems_current_user'` | ✓ |
| `login`: looks up by email in MockApi 'users' collection | `:64` `this._mockApi.get('users')` | ✓ |
| `login`: plain-text comparison with documented M1 limitation | `:67–69` — comment present; `:68` `record.password !== password` | ✓ |
| `login`: persists via StorageService, not direct localStorage | `:72` `this._storage.set(this._currentUserKey, record)` | ✓ |
| `login`: throws `'Invalid credentials'` on bad email/password | `:61`, `:69` | ✓ |
| `register`: validates name, email, password, role presence | `:93–96` | ✓ |
| `register`: email regex check | `:99–101` (EMAIL_REGEX = `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) | ✓ |
| `register`: password ≥4 chars | `:102–104` (MIN_PASSWORD_LENGTH = 4) | ✓ |
| `register`: duplicate email check | `:110–113`, throws `'Email already registered'` | ✓ |
| `register`: inserts via MockApi.post | `:117` `this._mockApi.post('users', user.toJSON())` | ✓ |
| `register`: auto-login (sets currentUser in storage) | `:118` `this._storage.set(this._currentUserKey, user.toJSON())` | ✓ |
| `logout`: removes storage key | `:127` `this._storage.remove(this._currentUserKey)` | ✓ |
| `getCurrentUser`: rehydrates with User.fromJSON | `:143` | ✓ |
| `getCurrentUser`: clears corrupt data instead of throwing | `:144–148` try/catch → log + remove + return null | ✓ |
| `isTeacher/isStudent`: check `user.role` against string literal | `:167`, `:177` | ✓ |

### Login flow trace (independent code analysis)

**Seed teacher login path:**

1. `App.jsx` mounts → `mockApi.seedIfEmpty().then(...)` → seeds `ems_users` with `[{email:'teacher@ems.dev', password:'password', role:'teacher',...}, ...]`
2. User navigates to `/login`; LoginPage renders (reachable at `/login` per routes.jsx:29–31 ✓)
3. User submits `email='teacher@ems.dev'`, `password='password'`
4. `auth.login('teacher@ems.dev', 'password')` called:
   - `!email || !password` → `false` (both non-empty) → passes guard
   - `this._mockApi.get('users')` → reads `ems_users` from StorageService → returns seed array
   - `users.find(u => u.email === 'teacher@ems.dev')` → finds record
   - `record.password !== 'password'` → `'password' !== 'password'` → `false` → no throw
   - `this._storage.set('ems_current_user', record)` → stores user in localStorage
   - Returns `User.fromJSON(record)` → User `{ email:'teacher@ems.dev', role:'teacher' }`
5. `onSuccess(user)` → `setCurrentUser(user)` in App → Landing renders "Welcome, Alice Teacher (teacher)"
6. `navigate('/')` → redirected to landing

**Result: seed teacher login succeeds as expected.** ✓

**Persistence on refresh:**

1. Refresh → App.jsx mounts fresh
2. `mockApi.seedIfEmpty()` → users collection already has data → `users.length > 0` → no-op
3. `auth.getCurrentUser()` → `this._storage.get('ems_current_user')` → returns stored record
4. `User.fromJSON(data)` → rehydrates User instance
5. `setCurrentUser(user)` → Landing renders authenticated state

**Result: persists across refresh.** ✓

**Logout:**

1. User clicks Logout → `handleLogout()` in Landing:
   - `auth.logout()` → `this._storage.remove('ems_current_user')`
   - `onAuthChange(null)` → `setCurrentUser(null)`
2. Refresh → `auth.getCurrentUser()` → `storage.get('ems_current_user')` → `null` → returns `null`
3. Landing renders unauthenticated state

**Result: logout clears session; post-logout refresh shows logged-out state.** ✓

**isTeacher/isStudent for seed users:**

- After `login('teacher@ems.dev','password')`: `getCurrentUser().role === 'teacher'` → `isTeacher()` = `true`, `isStudent()` = `false` ✓
- After `login('student@ems.dev','password')`: `getCurrentUser().role === 'student'` → `isStudent()` = `true`, `isTeacher()` = `false` ✓
- Before any login: `getCurrentUser()` = `null` → both `isTeacher()` and `isStudent()` = `false` ✓

### LoginPage — spec checks

| Requirement | Code | Result |
|---|---|---|
| Controlled form: email + password | `LoginPage.jsx:38–41`, `onChange` handlers `:87`, `:100` | ✓ |
| On submit: calls `auth.login(email, password)` | `:55` | ✓ |
| On success: calls `onSuccess(user)` + navigates to `/` | `:56–57` | ✓ |
| On error: renders error string + `notify.error()` | `:59–61` | ✓ |
| Link to `/register` | `:111` | ✓ |
| Demo creds hint visible | `:71–75`, `DEMO_CREDS` constant `:16–19` | ✓ |
| No auth business logic in component | Form state + delegation only | ✓ |
| No direct localStorage | Confirmed (grep below) | ✓ |
| No raw console | Confirmed (grep below) | ✓ |

### RegisterPage — spec checks

| Requirement | Code | Result |
|---|---|---|
| Controlled form: name, email, password, role select | `RegisterPage.jsx:35–38`, form inputs | ✓ |
| Role options from ConfigService (no magic strings) | `:33` `config.getRoles()` → `['teacher','student']`; `:123–126` rendered via `.map()` | ✓ |
| Client-side presence check | `:47–49` | ✓ |
| On submit: calls `auth.register({...})` | `:55` | ✓ |
| On success: `onSuccess(user)` + `navigate('/')` | `:56–57` | ✓ |
| On error: renders + `notify.error()` | `:59–61` | ✓ |
| Link to `/login` | `:136` | ✓ |
| No business logic in component | Delegation to AuthService only | ✓ |

### routes.jsx / App.jsx — spec checks

| Requirement | Code | Result |
|---|---|---|
| `/` route → Landing | `routes.jsx:25–28` | ✓ |
| `/login` route → LoginPage | `routes.jsx:29–32` | ✓ |
| `/register` route → RegisterPage | `routes.jsx:33–36` | ✓ |
| BrowserRouter wrap in App.jsx | `App.jsx:43` | ✓ |
| Landing shows "Welcome \<name\> (\<role\>)" when authenticated | `routes.jsx:65–74` | ✓ |
| Landing shows "Please log in or register" when not authenticated | `routes.jsx:83` | ✓ |
| Landing logout button calls `auth.logout()` | `routes.jsx:54–57` — delegates to AuthService | ✓ |
| No business logic in App.jsx | Seed + getCurrentUser delegation only | ✓ |
| Auth state propagated via callback props | `App.jsx:44` `onAuthChange={setCurrentUser}` | ✓ |

### services/index.js — wiring

`auth = new AuthService(mockApi, storage, config, logger)` at line 36. ✓  
Correct dependency order (no cycles): config → logger → storage/notify → mockApi → auth. ✓  
`auth` exported alongside existing services. ✓

---

## Independent test execution

### My vitest run

```
 RUN  v4.1.7 /Users/dormor/Desktop/Stocks/QuantDeploy/deployments/EMS_M1/client

 Test Files  7 passed (7)
      Tests  126 passed (126)
   Start at  23:19:56
   Duration  947ms (transform 251ms, setup 0ms, import 346ms, tests 45ms, environment 5.26s)
```

**126/126 PASS** — well above ≥28 cumulative spec requirement. ✓

### Test count reconciliation

Actual count verified against Vitest output (126) and D003 audit (106 prior):

| File | Actual Tests | Report Table |
|---|---|---|
| ConfigService.test.js | 13 | 13 ✓ |
| LoggerService.test.js | 13 | 13 ✓ |
| StorageService.test.js | 14 | 14 ✓ |
| NotifyService.test.js | 11 | 11 ✓ |
| models.test.js | 35 | 35 ✓ |
| MockApiService.test.js | **20** | **22 ✗** (carry-over error from D003 report) |
| AuthService.test.js | **20** | 20 ✓ |
| **Total** | **126** | **128 table / 126 Vitest** ✓ |

The MockApiService.test.js row remains mis-stated at 22 (actual 20) — carry-over error first flagged in D003 audit. The Vitest output of 126 is correct. Not a code defect.

### AuthService.test.js quality review (20 tests)

`mkAuth()` helper creates a fresh `MockApiService` + `AuthService` per test, seeding beforehand — proper isolation with real services and jsdom localStorage. ✓

| Suite | Tests | Coverage |
|---|---|---|
| Constructor guard | 1 | Missing mockApi throws ✓ |
| login() | 6 | Teacher creds ✓, student creds ✓, wrong password ✓, unknown email ✓, empty email ✓, persists to storage ✓ |
| register() | 6 | Creates + auto-logs ✓, persists in DB ✓, duplicate email ✓, invalid email ✓, short password ✓, missing name ✓ |
| logout() | 2 | Clears storage ✓, isAuthenticated false ✓ |
| getCurrentUser() + isAuthenticated() | 2 | Null when no session ✓, returns User after login ✓ |
| isTeacher() + isStudent() | 3 | Teacher role ✓, student role ✓, both false unauthenticated ✓ |

D004 spec required ≥6 new AuthService tests. Delivered 20. ✓

### Untested edge cases (informational, not blocking)

1. `register()` with `role` that is a valid string but not in `VALID_ROLES` (e.g., `'admin'`) — rejected by `!VALID_ROLES.includes(role)` at line 105, but no test for this path in AuthService.test.js.
2. `getCurrentUser()` with deliberately corrupt stored JSON — the try/catch at line 143–148 handles this, but no test injects a corrupt value. Low risk; `StorageService.get()` already returns `null` on malformed JSON (tested in D002).
3. `login()` with `password` as empty string — `!'' === true` → throws `'Invalid credentials'`. Covered for email; not explicitly for password. Symmetric behaviour — low risk.
4. `App.jsx` `seedIfEmpty().then(...)` still lacks `.catch()` — carry-over from D003 MINOR finding #2. Continues to be MINOR.

---

## Grep constraint verification (independent)

### localStorage exclusivity

```
grep -rn "localStorage\." client/src/ --include="*.js" --include="*.jsx" | grep -v "__tests__" | grep -v "StorageService.js"
```

Result: one match — `MockApiService.js:2` (JSDoc comment, not a call; established in D003 audit). ✓  
**No new localStorage violations introduced in D004.** ✓

Specific confirmation for JSX files:
```
grep -rn "localStorage\." client/src/pages/ --include="*.jsx"
grep -rn "localStorage\." client/src/app/ --include="*.jsx"
```
Both: **no output**. ✓

### console.* exclusivity

```
grep -rn "console\." client/src/ --include="*.js" --include="*.jsx" | grep -v "__tests__" | grep -v "LoggerService.js"
```

Result: **no output**. ✓  

Specific confirmation for JSX files:
```
grep -rn "console\." client/src/pages/ --include="*.jsx"
grep -rn "console\." client/src/app/ --include="*.jsx"
```
Both: **no output**. ✓

### No business logic in JSX

Grep confirms auth JSX files have zero direct storage or console access. Logic trace confirms:
- LoginPage.jsx: `auth.login()` call only, form state management
- RegisterPage.jsx: `auth.register()` call only, `config.getRoles()` for options (appropriate — reads config, not logic)
- routes.jsx: `auth.logout()` call only, conditional display on `currentUser` prop
- App.jsx: `mockApi.seedIfEmpty()` + `auth.getCurrentUser()` calls only

No raw auth decisions, password handling, or storage operations in any JSX file. ✓

---

## Production build verification (independent)

```
$ cd client && npm run build
vite v8.0.14 building client environment for production...
✓ 37 modules transformed.
dist/assets/index-BQHADlbG.js   247.72 kB │ gzip: 78.76 kB
✓ built in 98ms
```

**PASS** — 37 modules (up from 24 in D003: +13 new modules for AuthService, pages, routes, updated App, updated index). Bundle grows to 247.72 kB gzip 78.76 kB — expected from adding react-router-dom routing + auth pages. ✓

---

## Security audit

- **Hardcoded secrets:** None. ✓
- **Plain-text password storage:** Documented M1 limitation. `AuthService.js:3–6` module header warns explicitly. `AuthService.js:67` in-line comment `// M1 plain-text comparison — replace with bcrypt.compare() in M2.` ✓
- **Passwords not logged:** `this._logger.info('AuthService.login: %s (%s)', record.email, record.role)` — logs email+role, NOT password. ✓
- **`console.log` in committed code:** None. ✓
- **Demo creds in LoginPage:** `DEMO_CREDS` constant is fine — it contains the intentional seed credentials displayed in the UI for demo purposes. Not a secret. ✓

---

## Architecture review

- **Module boundaries:** `AuthService` → `MockApiService`, `StorageService`, `ConfigService`, `LoggerService`, `User` model — clean single-direction imports. ✓
- **No circular imports:** services/index.js is the single wiring point; no service imports from index.js back. ✓
- **No business logic in JSX:** confirmed across all 4 modified/new files. ✓
- **Auth state propagation:** `App.jsx` → `onAuthChange` prop → `setCurrentUser` — React state lifting pattern; no global mutable state. ✓
- **Register VALID_ROLES local constant:** `AuthService.js:20` — same pattern as models (local mirror to avoid circular import). ✓
- **JSDoc on all public methods:** All 7 AuthService methods documented with `@param`, `@returns`, `@throws`. ✓

---

## Git log verification

D004 required commits (spec: ≥5):

| # | SHA | Message | Status |
|---|---|---|---|
| 1 | `55294ab` | `feat: add AuthService with login, register, logout, role helpers` | ✅ |
| 2 | `5904d07` | `feat: add LoginPage with form, validation, and error display` | ✅ |
| 3 | `b81a19c` | `feat: add RegisterPage with role selection` | ✅ |
| 4 | `d187d08` | `chore: add minimal BrowserRouter scaffold for auth pages` | ✅ |
| 5 | `ed8b02e` | `test: add Vitest tests for AuthService` | ✅ |
| 6 | `660244d` | `docs: update ai-work-log with D004 entry` | bonus ✅ |

**6 commits on `dev`** (≥5 required). All conventional-commit format. Correct ordering confirmed. ✓  
**`origin/dev` push:** all 6 D004 commits confirmed on `origin/dev`. ✓

---

## Acceptance criteria checklist (D004.md)

| Criterion | Status | Evidence |
|---|---|---|
| AuthService implements all 7 methods | ✅ PASS | Each method verified in spec-literal review |
| Login + Register pages reachable at `/login` and `/register` | ✅ PASS | routes.jsx lines 29–36 |
| Seed teacher (`teacher@ems.dev`/`password`) can log in | ✅ PASS | Login flow traced; test confirmed; 2 seed-creds tests pass |
| After login, refresh keeps user logged in | ✅ PASS | Traced: `storage.set('ems_current_user',...)` → `getCurrentUser()` on remount |
| After logout, refresh shows logged-out state | ✅ PASS | Traced: `storage.remove(...)` → `getCurrentUser()` returns null |
| Register flow creates user and auto-logs in | ✅ PASS | `post()+set(currentUserKey,...)` in register(); test confirmed |
| No business logic in JSX | ✅ PASS | Grep + code review; all auth delegated to AuthService |
| `npx vitest run` passes; ≥28 cumulative | ✅ PASS | 126/126 (≥28 ✓) |
| StorageService only localStorage caller | ✅ PASS | Grep: 0 new violations in D004 files |
| LoggerService only non-test console caller | ✅ PASS | Grep: 0 matches outside LoggerService.js |
| ≥5 conventional commits on dev | ✅ PASS | 6 commits confirmed |
| `git push origin dev` succeeded | ✅ PASS | origin/dev matches dev HEAD |

All 12 acceptance criteria: **PASS**.

---

## Findings

### CRITICAL findings

*(none)*

### MINOR findings

1. **`App.jsx:28`** — `mockApi.seedIfEmpty().then(...)` still lacks a `.catch()` handler — carry-over from D003 MINOR finding #2. If `seedIfEmpty()` rejects, `ready` stays `false` and the app freezes on "Loading EMS_M1…" with no error displayed. With D004, the impact is now slightly higher: the user cannot reach any auth page (LoginPage/RegisterPage are gated behind `ready=true`). Recommended fix: add `.catch((err) => { logger.error('Boot seed failed: %s', err.message); setReady(true); })` so the app renders even if seeding fails. This is the second D-task in a row with this unfixed finding — should be addressed before D005 wires the full layout.

2. **`AuthService.js:20`** — `VALID_ROLES = ['teacher', 'student']` local constant mirrors ConfigService. Consistent pattern with models and previous services — the rationale (avoiding circular import) holds. Same as prior MINOR findings in D002/D003. Recommend Team Lead document this pattern as an explicit project convention in CLAUDE.md or MASTER_PLAN so it's not repeatedly flagged.

3. **Implementer report table** — `MockApiService.test.js` row still listed as 22 tests (actual: 20). Table total shows 128 (actual: 126). Vitest output of 126 is correct and cited accurately in the narrative. Third consecutive D-task with this carry-over error; Team Lead should note it is a persistent report template defect.

### NOTE findings

1. **`LoginPage.jsx:47–49`** — Client-side guard `if (!email || !password)` fires before `auth.login()` and shows "Email and password are required" — correct. However, the guard prevents `auth.login()` from seeing empty strings, which means the `login()` branch `if (!email || !password)` at `AuthService.js:60` is unreachable from the form. It IS reachable from direct programmatic calls — correct defence-in-depth pattern. ✓

2. **`RegisterPage.jsx:38`** — `const [role, setRole] = useState(roles[0])` defaults to `'teacher'` (first element in ConfigService's `getRoles()`). If the roles array changes order in a future milestone, the default silently changes. Low risk for M1. Could be `useState('student')` to default new users to the lower-privilege role — but this is a UX preference, not a spec defect.

3. **`routes.jsx` imports `{ auth }` directly** — the Landing component inside routes.jsx imports `auth` from services/index.js at module level (line 12). This means `auth` is captured at import time. If tests import routes.jsx, they'd get the real singleton. No issue for current test suite (no routes tests yet), but worth noting for D005 when route tests may be added.

---

## Follow-up questions for Team Lead

1. **(`App.jsx .catch()`)** — MINOR finding #1 above is now the second D-task in a row without a fix. Should this be required as a fix commit before D005 (which fully replaces App.jsx anyway), or waived since D005 will rewrite App.jsx? Recommendation: waive if D005 adds the handler when rewriting.

2. **(`VALID_ROLES` local-mirror pattern`)** — The pattern of mirroring ConfigService values as local module-level constants (to avoid circular imports) has now appeared in: `StorageService.js` (`EMS_KEY_PREFIX`), `Exam.js` (`VALID_STATUSES`), `Question.js` (`VALID_TYPES`), `User.js` (`VALID_ROLES`), `AuthService.js` (`VALID_ROLES`). Should this be documented as an explicit project convention to stop re-flagging it as MINOR? Or should a separate `constants.js` module be created that all of these can import without circular risk?

3. **(`Report table MockApiService: 22`)** — The Implementer's report template carries this error forward each D-task. Worth correcting it in the D-task template so future implementers get the right count.

---

## Verdict reasoning

All 12 D004 acceptance criteria pass independently. The Vitest suite ran 126/126 — well above the ≥28 cumulative minimum. Both grep constraints are clean: no new localStorage calls outside StorageService, no console calls outside LoggerService in any production file including the new JSX pages. The full auth flow was traced end-to-end: seed-teacher login, persistence across refresh, and logout all work correctly as implemented. All 7 AuthService methods are present, correctly spec-compliant, and covered by tests. Routes `/login` and `/register` are reachable. `isTeacher`/`isStudent` return correct booleans for both seed users.

The three MINOR findings are quality/pattern issues: the carry-over `.catch()` gap (D003-inherited), a local VALID_ROLES mirror pattern (consistent with prior tasks), and a report template counting error. None affect correctness, security, or spec compliance for D004's scope.

**Verdict: PASS**
