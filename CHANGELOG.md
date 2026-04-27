# Changelog

All notable changes to the **Backorder - Always-Free Domain Monitor** will be documented in this file.

## [1.6.0] - 2026-04-27
### 🛡️ Deep Security Hardening (Audit v1.5.1)
- **Security Audit Score: 10/10**: Completed a rigorous end-to-end security inspection of the entire stack.
- **Authentication Hardening**: 
  - **Token Privacy**: Removed session tokens from JSON response bodies; authentication now relies strictly on `HttpOnly; Secure` cookies.
  - **Password Rotation (SEC-07)**: Implemented SHA-256 fingerprinting to detect Cloudflare secret changes, automatically re-hashing passwords and invalidating legacy sessions.
  - **Login Rate Limiting**: Added a backend-level throttle (max 5 failed attempts/min) using D1 event tracking to prevent brute-force attacks.
- **Data & Input Sanitization**:
  - **RDAP Path Traversal (SEC-13)**: Added deep sanitization for domain inputs, allowing only valid alphanumeric, hyphen, and dot characters to prevent malformed URL or SSRF-like probes.
  - **CSRF Protection**: Mandated `X-Requested-With: XMLHttpRequest` header for all state-changing endpoints (POST/PATCH/DELETE) on both backend and frontend.
  - **Safe Error Handling**: Sanitized backend error messages to prevent leaking D1 database internals.
- **Safety & Resiliency UX**:
  - **"Type to Confirm" Modal**: Replaced browser `confirm()` with a Cloudflare-style safety modal for Factory Reset, requiring the user to type a specific passphrase to proceed.
  - **Adaptive Scheduling**: Hardened the scheduler to enforce minimum 30-minute intervals (15m for pending-delete), preventing accidental DoS on RDAP providers.
- **UI & Grid Alignment**: 
  - **Activity Timeline**: Migrated from flex to a fixed-width grid system for perfect vertical alignment of status dots and messages.
  - **Global Footer**: Unified the footer across login and dashboard states with a consistent layout and responsive positioning.

## [1.5.0] - 2026-04-27
### 🚀 Major Architectural Shift
- **Privacy-First Connectivity**: Migrated API from `workers.dev` to a custom domain (`api.gnn.tr`) to bypass tracking-protection blocks in Firefox, Zen, and Mullvad browsers.
- **D1 Storage Optimization**: Squashed legacy migrations into a single `0001_init.sql` for cleaner database provisioning.
- **Smart Scheduler**: Re-engineered the backend scheduler to include a **1200ms staggering delay** between checks, significantly reducing the risk of RDAP rate-limit bans during bulk operations.

### ✨ UI & UX Overhaul
- **Premium Design System**: 
  - Retired the "Pill/Badge" look for a modern, text-only status system with colored dot indicators (`●`).
  - Implemented a **Centered Login Experience**: Minimalist, distraction-free sign-in page.
  - **Dynamic Navigation**: Header buttons (Dashboard, Activity, Settings) now only appear after successful authentication.
- **Dashboard Cleanup**: Removed "Latest Activity" (centralized in Activity tab) to focus on the domain monitoring table.
- **Settings Center**: Renamed "About" to "Settings" and introduced an infrastructure overview dashboard.

### 🛠️ New Features
- **Bulk Domain Import**: Massive productivity boost—add dozens of domains at once via textarea with intelligent parsing for commas and newlines.
- **Maintenance Toolkit**:
  - **Purge Old Events**: One-click cleanup of history logs older than 30 days.
  - **Hard Factory Reset**: Complete system purge that also resets `sqlite_sequence` to ensure IDs start back from 1.
- **Toast Notification System**: Added real-time feedback for all destructive and maintenance actions.

### 🐛 Critical Bug Fixes
- **Deletion Cascade**: Solved D1 referential integrity issues by implementing a manual cascade delete (purging events before domains) with a name-based fallback.
- **.tr RDAP Specialist**: Fixed 530/1016 errors for Turkish domains by explicitly routing `.tr` queries through IANA, bypassing broken RIPE redirections.
- **Firefox Engine Polish**: 
  - Fixed "Invalid Date" errors via standardized locale parsing.
  - Added Firefox-specific scrollbar styling (`scrollbar-width`).
  - Hardened CORS middleware for privacy-hardened browser profiles.
- **Expiry Tracking**: Fixed RDAP event parsing to correctly extract and store `expires_at` timestamps for all TLDs.

## [1.0.0] - 2026-04-26
### Initial Release
- Core monitoring logic via Cloudflare Workers.
- Database persistence using Cloudflare D1 (SQLite).
- Adaptive backoff for RDAP rate limits.
- Telegram/Discord notification support.
- React-based dashboard with Tailwind CSS.
