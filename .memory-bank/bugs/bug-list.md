# Bug List & Environment Caveats

This document lists tracked bug reports, runtime environment caveats, and D1 database limitations to prevent regressions.

## Active Caveats and Limitations

### 1. Cloudflare D1 Auto-Increment Behavior
* **Type**: SQLite Database Limitation
* **Confidence**: Verified
* **Status**: Open / Handled in Code
* **Description**: `DELETE FROM table` does not reset the auto-increment counter (`sqlite_sequence`) in Cloudflare D1.
* **Suggested Action/Mitigation**: When performing a system hard reset (Factory Reset), explicitly delete rows from `sqlite_sequence` to ensure IDs start back from 1.

### 2. Cloudflare D1 Referential Integrity (Foreign Keys)
* **Type**: Database Constraint Caveat
* **Confidence**: Verified
* **Status**: Open / Handled in Code
* **Description**: While D1 enforces foreign keys, a cascade delete has historically failed or behaved unpredictably under specific conditions.
* **Suggested Action/Mitigation**: The delete handler should manually purge related records from `events` prior to purging records from `domains` as a safety cascade fallback.

### 3. IANA RDAP Redirection Failures for `.tr` Domains
* **Type**: Third-party Integration Bug
* **Confidence**: Verified
* **Status**: Open / Handled in Code
* **Description**: Standard RDAP redirection (e.g. via RIPE) frequently fails or returns 530/1016 error codes for Turkish `.tr` (Trabis) domains.
* **Suggested Action/Mitigation**: Explicitly bypass standard RDAP registry redirects and route `.tr` queries directly to `rdap.iana.org`.
