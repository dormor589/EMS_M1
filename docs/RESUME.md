# How to resume the EMS_M1 deployment for Milestone 2

This deployment used three persistent sessions whose UUIDs are saved locally
(gitignored) under the deployment root:

- `.team_lead_session_id` — Team Lead (Opus 4.7, interactive Claude Code)
- `.implementer_session_id` — Implementer worker (Sonnet 4.6, `claude -p --resume`)
- `.qa_session_id` — QA worker (Sonnet 4.6, `claude -p --resume`)

## Option 1 — Try to resume each session as-is

### Team Lead (interactive Claude Code app/CLI)
```bash
SID=$(cat /Users/dormor/Desktop/Stocks/QuantDeploy/deployments/EMS_M1/.team_lead_session_id)
claude --resume "$SID"
```
This re-opens the original interactive session with full M1 chat history.
Caveats:
- Resume works for ~recent sessions; reliability degrades over long gaps.
- The session transcript is stored at
  `~/.claude/projects/-Users-dormor-Desktop-Stocks-QuantDeploy-deployments-R16/<UUID>.jsonl`
  and must still exist.
- Resume may auto-compact if context is large; that's fine.

### Implementer + QA (headless `claude -p` workers)
These are resumed automatically by the `/implement` and `/qa` skills as long
as their session-id files exist. No manual resume needed — just dispatch a
new D-task and the skill picks up where the prior session left off.

## Option 2 — Fresh Team Lead (if resume fails)

If `claude --resume` no longer finds the session, start a fresh Team Lead and
bootstrap it with this context:

1. Launch a new Claude Code session.
2. Point it at:
   - `core/SENIOR_DEPLOY_HANDOFF.core.md` (manual)
   - `deployments/EMS_M1/SENIOR_DEPLOY.overlay.md` (overlay)
   - `deployments/EMS_M1/MASTER_PLAN.md` (original plan)
   - `deployments/EMS_M1/docs/STATUS.md` (close-out state of M1)
   - `deployments/EMS_M1/docs/spec_brief.txt` (M1 spec; M2 brief will be your new spec)
3. Have it read `findings.jsonl` cursor-style and `deploy_requests/INDEX.jsonl`
   to reconstruct the audit trail.
4. New Team Lead writes a new MASTER_PLAN for M2 and resumes the same workers
   via the existing `.implementer_session_id` / `.qa_session_id`.

## Option 3 — Fresh everything (clean M2)

If you want a clean break for M2 (new workers too):
1. Delete the three `.*_session_id` files.
2. Re-run the §12 First Action protocol from `SENIOR_DEPLOY_HANDOFF.core.md`
   to generate fresh worker UUIDs and re-initialize sessions.
3. Author new overlays if M2's scope/constraints differ materially.

## Practical recommendation

For Milestone 2:
- **Workers (Implementer/QA): keep the same sessions.** They have built-up
  knowledge of file layout, conventions, and patterns. Big win.
- **Team Lead: try Option 1 first.** If `claude --resume` works, you keep the
  full conversational history of M1 decisions, scope discussions, and the
  process refinements we made along the way. If it fails, fall back to Option
  2 — STATUS.md + MASTER_PLAN are enough to bootstrap a fresh TL with minimal
  loss.
