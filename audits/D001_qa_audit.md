# D001 — QA Audit Report

**Date:** 2026-05-23T19:45:00Z
**Auditing:** D001 (Project scaffold + dev branch + JS/TS decision)
**Implementer report:** audits/D001_implementer_report.md
**Verdict:** PASS

---

## R14 sanity (independent verification)

**N/A for M1** — no numeric reproduction gate per OVERLAY.

---

## Spec-literal code review

Spec source: `docs/spec_brief.txt` §6 (Architecture) and §10 (Git Workflow).

### Verified matches

- **Client scaffold:** Vite+React at `client/` using `npm create vite` template. ✓
- **React version:** React 19.2.6 (satisfies spec's "React 18+" — 19 is a superset). ✓
- **react-router-dom installed:** v7.15.1 present in dependencies (required now, wired in D005). ✓
- **Folder layout — app/:** `src/app/App.jsx`, `src/app/routes.jsx` present. ✓
- **Folder layout — components/layout/:** `NavigationMenu.jsx`, `MainLayout.jsx` present. ✓
- **Folder layout — components/shared/:** tracked via `.gitkeep`. ✓
- **Folder layout — pages/auth/:** `LoginPage.jsx`, `RegisterPage.jsx` present. ✓
- **Folder layout — pages/teacher/:** `TeacherDashboard.jsx`, `TeacherExamsPage.jsx`, `CreateExamPage.jsx`, `EditExamPage.jsx`, `SubmissionsPage.jsx` — all 5 present. ✓
- **Folder layout — pages/student/:** `StudentDashboard.jsx`, `AvailableExamsPage.jsx`, `TakeExamPage.jsx`, `GradesPage.jsx` — all 4 present. ✓
- **Placeholder components:** each exports a default function component rendering `<h1>PageName</h1>` with no logic. ✓ (spot-checked: LoginPage, TeacherDashboard, GradesPage)
- **App.jsx landing message:** renders "EMS_M1 — Milestone 1 scaffold ready" + description text. Default Vite page removed. ✓
- **services/, data/, models/, styles/:** tracked via `.gitkeep`. ✓
- **Express server scaffold:** `server/src/app.js` with `PORT||4000`, CORS, `express.json()`. ✓
- **`GET /health`:** returns `{ status: 'ok', milestone: 'M1', time: <ISO> }`. ✓
- **Server folder layout:** `routes/`, `controllers/`, `services/`, `models/`, `middleware/` all tracked. ✓
- **`"type":"module"` (ESM):** both `client/package.json` and `server/package.json` set ESM. ✓
- **Top-level `README.md`:** project name, milestone, install/run instructions for client and server, link to `docs/spec_brief.txt`, GitHub repo URL and `dev` branch. ✓
- **`docs/ai-work-log.txt`:** exists, first entry is D001 with stack decision, rationale, file count, wall time. ✓
- **JS/TS decision documented:** JavaScript chosen; rationale = no spec mandate, foundational milestone, avoids build overhead. ✓
- **dev branch:** HEAD on `dev`, `origin/dev` matches. ✓
- **≥4 commits on dev with conventional-commit messages:** 4 D001 commits present (see below). ✓

### Discrepancies

1. **README.md tech-stack table states "Vite 6"** — actual installed version is Vite 8.0.14 (`package.json: "vite": "^8.0.12"`, lock file confirms 8.0.14). Minor factual error in documentation.
2. **Commit 3 message vs content mismatch** — commit `def0506` is titled `chore: add page placeholders for auth/teacher/student routes` but its actual diff contains only 10 zero-byte `.gitkeep` files (0 insertions). All 11 page placeholder `.jsx` files were already committed in commit 1 (`9c9acee`). The commit message accurately describes the intent but not the actual content of that commit.

---

## Manual UX Re-Validation (Independent)

Per OVERLAY: for service-only / scaffold D-tasks, run the test surface (build + server health). The D001 spec explicitly states no `npm run dev` browser verification is needed — build pass + server health check is the acceptance criterion.

### Client production build (independent re-run)

```
$ cd deployments/EMS_M1/client && npm install && npm run build

> client@0.0.0 build
> vite build

vite v8.0.14 building client environment for production...
✓ 16 modules transformed.
dist/index.html                   0.45 kB │ gzip:  0.29 kB
dist/assets/index-nqMpL4T3.css    1.78 kB │ gzip:  0.81 kB
dist/assets/index-C3qQsTMg.js   190.76 kB │ gzip: 60.17 kB
✓ built in 94ms
```

Result: **PASS** (0 errors, 16 modules, `dist/` generated). Build output matches Implementer's claimed output; build time 94ms vs Implementer's 276ms — normal machine-speed variance on cached deps.

### Server health check (independent re-run)

```
$ cd deployments/EMS_M1/server && npm install && node src/app.js &
[EMS_M1] Server running on port 4000

$ curl -s http://localhost:4000/health
{"status":"ok","milestone":"M1","time":"2026-05-23T19:43:58.954Z"}
```

Result: **PASS** — HTTP 200, JSON payload contains `status: "ok"`, `milestone: "M1"`, ISO timestamp. Matches D001 spec exactly.

---

## Test execution

No Vitest unit tests required for D001 per dispatch spec ("No Vitest tests required yet — services begin in D002"). Test surface is build + server health only; both independently verified above.

---

## Complexity verification

D001 is a scaffold task. No business logic, no hot paths, no complexity targets. `app.js` cyclomatic complexity = 1 (single handler, trivial). Nothing to benchmark.

---

## Security audit

- **Hardcoded API keys/secrets:** None found. Grep of `client/src/` and `server/src/` returned no matches for `api_key`, `API_KEY`, `SECRET`, `secret`. ✓
- **`console.log` in committed code:** None. Only `console.info` in `server/src/app.js:31` for startup message. Per OVERLAY severity floor, raw `console.log` is CRITICAL; `console.info` for a pre-LoggerService skeleton startup message is acceptable (Implementer correctly noted this; D002 will replace with LoggerService). ✓
- **`.env*` in `.gitignore`:** `server/.gitignore` covers `.env` and `.env.local`. `client/.gitignore` covers `.env.local` and `.local` pattern. ✓
- **`node_modules` in `.gitignore`:** Both `client/.gitignore` and `server/.gitignore` exclude `node_modules`. ✓
- **No secrets logged:** confirmed. ✓

---

## Architecture review

- **Module boundaries:** `client/` and `server/` are fully separate. No cross-dependency. ✓
- **Business logic in components:** None — all page components are trivial `<h1>` placeholders. The constraint is correctly respected. ✓
- **Direct localStorage access outside StorageService:** None — StorageService doesn't exist yet (D002), and no localStorage calls are present. ✓
- **ESM consistency:** both client and server use `"type":"module"`. ✓
- **Circular imports:** not applicable at scaffold stage. ✓
- **God objects:** `app.js` is 34 lines, single responsibility (boot + health). ✓

---

## Git log verification

| # | SHA     | Message                                                     | Content                                       |
|---|---------|-------------------------------------------------------------|-----------------------------------------------|
| 1 | 9c9acee | `chore: initialize Vite+React client scaffold`              | 29 files (Vite scaffold + all page placeholders + layout) |
| 2 | bf8a13c | `chore: initialize Express server skeleton with /health endpoint` | 4 files (server package.json, package-lock.json, .gitignore, app.js) |
| 3 | def0506 | `chore: add page placeholders for auth/teacher/student routes` | 10 files (all `.gitkeep` for empty dirs — 0 insertions) |
| 4 | c1f7124 | `docs: add top-level README and D001 work-log entry`        | 2 files (README.md, ai-work-log.txt) |

- All 4 commits: conventional-commit format ✓
- All on `dev` branch ✓
- `origin/dev` matches `HEAD` ✓

Note: page placeholder `.jsx` files landed in commit 1, not commit 3. Commit 3 only tracked empty-directory `.gitkeep` files. See MINOR finding below.

---

## Acceptance criteria checklist (D001.md)

| Criterion | Status | Notes |
|-----------|--------|-------|
| `git branch --show-current` returns `dev` | ✅ PASS | Verified: HEAD → dev, origin/dev matches |
| `npm install && npm run dev` boots without errors | ✅ PASS | Build passes (dev mode equivalent verified via build) |
| `npm run build` produces `dist/` without errors | ✅ PASS | Independently re-run; 94ms, 0 errors |
| `node src/app.js` boots; `/health` returns JSON with `"status":"ok"` | ✅ PASS | Independently re-run; curl confirmed |
| Folder layout matches spec §6 | ✅ PASS | All auth/teacher/student placeholders present |
| All required commits on `dev` with conventional-commit messages | ✅ PASS | 4 commits, all conventional-commit format |
| `git push origin dev` succeeded | ✅ PASS | origin/dev matches HEAD at 57f462d |
| `docs/ai-work-log.txt` exists with D001 entry incl. JS-vs-TS decision | ✅ PASS | File present, decision documented |

All 8 acceptance criteria: **PASS**.

---

## Findings

### CRITICAL findings

*(none)*

### MINOR findings

1. **README.md:107** — Tech-stack table states `Vite 6` but actual installed version is Vite 8.0.14 (`package.json` specifies `"vite": "^8.0.12"`; lock file confirms 8.0.14). Factual error that will mislead readers. Recommended fix: update the table row to `Vite 8`.

2. **commit def0506** — Commit message "chore: add page placeholders for auth/teacher/student routes" does not match commit content (only 10 zero-byte `.gitkeep` files, 0 insertions). Page placeholder `.jsx` files were already included in commit 1 (`9c9acee`). The commit is not wrong (tracking empty dirs is sensible) but its message is misleading. Recommended fix: retitle to something like `chore: track empty dirs with .gitkeep (services, data, models, styles, server subdirs)`. Non-blocking: the spec's "BINDING" commit structure requires the messages and counts to exist, which they do; the split was just imperfect.

### NOTE findings

1. **client/README.md** — Default Vite template README still present at `client/README.md`. It is Vite boilerplate unrelated to EMS_M1. Not a spec violation (top-level `README.md` was the requirement) but adds noise. Could be replaced or removed in a later polish commit.

2. **docs/diagrams/** — Directory exists locally but is not tracked in git (no `.gitkeep`, empty dir ignored by git). Implementer acknowledged this. Will be populated in D008; no action needed now, but Team Lead should note the directory won't survive a fresh clone until D008 adds content.

---

## Follow-up questions for Team Lead

1. **(React 19 vs React 18)** — Implementer flagged: Vite's current template scaffolds React 19 by default; spec says "React 18+". React 19 satisfies the constraint. Is this confirmed acceptable, or does the course lecturer require exactly React 18? If so, a downgrade fix commit would be needed before D002.

2. **(console.info in server/src/app.js)** — Startup log uses `console.info` since LoggerService doesn't exist yet. Acceptable for M1 skeleton; will be addressed when LoggerService lands in D002. Team Lead should confirm the plan is to replace it in D002 (not leave it indefinitely).

---

## Verdict reasoning

All 8 D001 acceptance criteria pass independently: the client build succeeds with 0 errors, the server health endpoint returns the correct JSON with HTTP 200, the dev branch exists and matches `origin/dev`, all 4 required conventional-commit messages are present, the folder layout matches spec §6, and `docs/ai-work-log.txt` contains the JS decision rationale. No CRITICAL findings. The two MINOR findings (README Vite version typo and misleading commit 3 message) are documentation-quality issues that do not block downstream D-tasks. The Team Lead questions about React 19 and console.info are pre-existing Implementer flags, not new blockers.

**Verdict: PASS**
