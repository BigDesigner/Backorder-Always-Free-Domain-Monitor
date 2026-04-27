# Changelog

All notable changes to the **Backorder - Always-Free Domain Monitor** will be documented in this file.

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
