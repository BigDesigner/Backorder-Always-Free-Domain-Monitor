# System Coherence

This document defines the operational protocols, checks, and coherence guardrails for the Backorder Domain Monitor project memory bank.

## 1. Operating Rules & Modes

### 1.1 Operating Mode Detection
- **CI Mode**: Triggered when environment variable `CI=true` is set. Non-interactive, overrides interactive approval blocks, and outputs a run summary to `.memory-bank/changelog/ci-run-summary.md` and `GITHUB_STEP_SUMMARY` if available.
- **Interactive Mode**: Default mode. Requires user confirmation for discovery, architecture decision records based on unconfirmed facts, validation execution, and staging/committing files.

### 1.2 Worktree Cleanliness Checks
- Before performing any migration or feature work, check the status of the git worktree using `git status`.
- In **Interactive Mode**, if the worktree is dirty, halt and notify the user to either stash, commit, or discard changes before proceeding.
- In **CI Mode**, record dirty files in `.memory-bank/bugs/bug-list.md` under `Unconfirmed / Environment Warning` and continue.

### 1.3 Branch Awareness
- Verify the active git branch before session operations.
- Update `.memory-bank/active-session.json` with the current branch and last commit hash on initialization.

---

## 2. Safety and Execution Boundaries

### 2.1 Context Drift Prevention
- Always refer back to `.specs/` and `.memory-bank/` files before starting a coding task to keep system requirements aligned.
- Avoid modifying core files such as `.specs/constitution.md`, `.specs/boundary-conditions.md`, or `.memory-bank/system-coherence.md` without explicit user permission.

### 2.2 Pre-change Checklist
1. Verify git worktree status is clean or accounted for.
2. Confirm the active branch matches the target branch.
3. Review `.specs/boundary-conditions.md` to ensure security, CORS, and deployment boundaries are respected.
4. Read `.tasks/pipeline.md` to identify active tasks.

### 2.3 Post-change Checklist
1. Review modifications via `git diff` or local checks.
2. Propose or execute recommended validation commands (such as linting and typechecking in `frontend` and `worker` subdirectories).
3. Update `.tasks/pipeline.md` and mark tasks as complete.
4. Prepare a handoff report in `.tasks/handoff.md`.

---

## 3. Decision & Validation Protocols

### 3.1 Unconfirmed Decision Protocol
- Every architectural detail or config value must be marked as `Verified`, `Inferred`, or `Unconfirmed`.
- If an `Unconfirmed` fact affects security, deployment topology, database integrity, or public API behavior, stop and query the user in Interactive Mode.
- In CI Mode, create ADRs with `Status: Proposed` and `Confidence: Unconfirmed`, marked clearly for human review.

### 3.2 Validation Recommendation Rules
- Do not execute validation commands automatically. Recommend them to the user based on the workspace configuration:
  - **Frontend (Vite/React/TS)**: `npm run build` (typechecks and builds) or `npm run dev`.
  - **Worker (Hono/Wrangler)**: `npm run typecheck`, `npm run lint`, `npm run dev`, or wrangler migrations.
- If a command is missing, record it as `Environment unavailable` and suggest prerequisite installation.

### 3.3 Handoff & Session End
- Summarize changes, validations, and outstanding items in `.tasks/handoff.md`.
- Reset the status in `.memory-bank/active-session.json` to idle/completed.
