# Changelog

All notable changes to the **Backorder - Always-Free Domain Monitor** will be documented in this file.

## [1.1.0] - 2026-04-27
### Added
- **Bulk Domain Import**: Support for adding multiple domains at once via textarea (comma or newline separated).
- **Database Maintenance**:
  - `Clean Events`: Removes events older than 30 days to keep D1 database lean.
  - `Factory Reset`: Fully purges the database and resets auto-increment ID counters.
- **Enhanced Status Indicators**: Replaced badge/pill UI with clean colored text and decorative dot indicators.
- **Custom API Domain**: Integrated `api.gnn.tr` as the primary API endpoint to bypass privacy browser (Firefox, Zen, Mullvad) blocks on `workers.dev` subdomains.

### Fixed
- **Firefox Compatibility**: 
  - Standardized scrollbar styling for Firefox engines.
  - Fixed CORS issues related to privacy-hardened browsers.
  - Standardized date parsing (`fmtTime`) to prevent `Invalid Date` errors.
- **Staggered Checks**: Implemented a 1.2s delay between domain checks in the scheduler to prevent RDAP rate limiting during bulk imports.
- **.tr RDAP Routing**: Explicitly routed `.tr` domains to `rdap.iana.org` to bypass RIPE-to-Trabis 530/1016 redirection errors.
- **ID Counter Reset**: Ensured `sqlite_sequence` is cleared during a factory reset so IDs start from 1.

### Changed
- **UI Simplification**: 
  - Removed "Latest Activity" from Dashboard (centralized in Activity tab).
  - Renamed "About" to "Settings" and reorganized technical information.
  - Centered Login screen and hidden navigation buttons for unauthenticated users.
- **D1 Optimization**: Reduced scheduler batch limit to 20 domains per run to stay within Cloudflare free tier wall-clock time limits while using staggered delays.

## [1.0.0] - 2026-04-26
### Initial Release
- Core monitoring logic via Cloudflare Workers.
- Database persistence using Cloudflare D1 (SQLite).
- Adaptive backoff for RDAP rate limits.
- Telegram/Discord notification support.
- React-based dashboard with Tailwind CSS.
