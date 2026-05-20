# Constitution

This document defines the engineering standards, code conventions, and UI/UX patterns expected in the Backorder Domain Monitor project.

## 🛠️ Code Quality and Linting Standards

### 1. Type Safety
- Strict TypeScript configuration is enabled across the frontend and backend.
- Do not use `any` type annotations unless absolutely necessary. Propose explicit interfaces or utility types.
- Ensure all modules pass `npm run typecheck` prior to submission.

### 2. Linting & Formatting
- Code formatting and style rules are checked using ESLint.
- Always run `npm run lint` in the `worker` subdirectory to detect quality alerts or unused imports.

---

## 🎨 UI/UX Design System Standards

### 1. Minimalist Status Indicators
- **Rule**: Do not use pill-style badges for domain check statuses.
- **Pattern**: Status indicators must use a text-only representation paired with a colored dot (`●`).
  - Green dot for active/available.
  - Yellow/red for rate-limited, expired, or pending delete.

### 2. Centered Login Experience
- The authentication screen must be minimalist, centered, and distraction-free.

### 3. Dynamic Navigation
- Header buttons (Dashboard, Activity, Settings) must only be rendered once the user has successfully authenticated.

### 4. Safety First Confirmation Modals
- **Rule**: Never use native browser `confirm()` popups for destructive actions (e.g., Factory Reset, database purges).
- **Pattern**: Implement a custom "Type to Confirm" modal requiring the user to type a specific passphrase (e.g. `FACTORY RESET`) to prevent accidental data loss.

### 5. Unified Footer Layout
- The global page footer must be consistent across both the unauthenticated Login state and the authenticated Dashboard/Settings views, with responsive positioning.

### 6. Utilities for Styling
- Use the styling helper utilities (e.g. `lib/ui.ts` class generators) to ensure CSS/Tailwind classes are consolidated and unified.

---

## 🔧 Maintenance and Versioning

### 1. Changelog Updates
- Document all notable features, fixes, and architectural adjustments in `CHANGELOG.md` under standardized headers (e.g., `🛡️ Deep Security Hardening`, `🚀 Major Architectural Shift`, `✨ UI & UX Overhaul`).

### 2. Commit Hygiene
- Keep commits focused and atomic.
- Suggested prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `style:`.
- Ensure changes compile locally before pushing.
