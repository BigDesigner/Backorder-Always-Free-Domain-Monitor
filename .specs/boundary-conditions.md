# Boundary Conditions

This document specifies the structural limits, security policies, and performance constraints of the Backorder Domain Monitor project.

## 🔐 Security Constraints

### 1. Authentication and Token Handling
- Session tokens MUST NOT be returned in JSON response bodies. Authentication relies strictly on `HttpOnly; Secure` cookies. [Verified]
- **Password Rotation (SEC-07)**: The system verifies password hashes using a SHA-256 fingerprint generated from the Cloudflare secrets. If a secret changes, the system invalidates legacy sessions and re-hashes passwords. [Verified]
- **Rate Limiting**: Login attempts are throttled to a maximum of 5 failed attempts per minute per IP using D1 event tracking to prevent brute-force attacks. [Verified]

### 2. Input Sanitization and Path Traversal
- **RDAP Path Traversal (SEC-13)**: Domain inputs must be deeply sanitized. Only alphanumeric characters, hyphens, and dots are permitted. All others are stripped or rejected to prevent directory traversal or SSRF-like injection attacks. [Verified]
- **CSRF Protection**: State-changing API endpoints (POST, PATCH, DELETE) MUST mandate the `X-Requested-With: XMLHttpRequest` header to prevent cross-site request forgery. [Verified]
- **Error Handling**: Database exception tracebacks must be caught and summarized to prevent leaking SQLite/D1 internals in API responses. [Verified]

---

## 🌐 Network and Connectivity Boundaries

### 1. CORS Policies
- CORS configurations in the worker (configured at `worker/src/index.ts`) must explicitly allow and restrict headers and origin domains to match the configured frontend hostname (e.g. `yourdomain.com`), rather than using wildcard values. [Verified]

### 2. Custom Domain Proxy Requirement
- Privacy-focused browsers (such as Firefox, Zen, and Mullvad) block default `*.workers.dev` endpoints.
- To bypass this tracking-protection constraint, the API MUST be served through a custom domain mapping (such as `api.yourdomain.com`). [Verified]

### 3. Third-party RDAP Routing
- **.tr Domains**: Standard RDAP routing often fails for Turkish domain registrations (Trabis). The backend must intercept requests containing `.tr` suffixes and explicitly route queries directly to `rdap.iana.org`. [Verified]
- **Scheduler Backoff**: Check intervals are restricted to a minimum of 30 minutes (15 minutes for domains pending delete) to avoid overloading public RDAP nodes. [Verified]
- **API Request Staggering**: A delay of **1200ms** must be applied between checking individual domains during batch cron triggers to avoid triggering RDAP rate limits. [Verified]

---

## 🗄️ Database & Storage Constraints (Cloudflare D1)

- **Referential Integrity**: Although foreign keys are declared, manual delete ordering is required. For clean execution, the database layer should manually purge dependent records from the `events` table before purging records from the `domains` table. [Verified]
- **Reset Sequence**: Performing `DELETE FROM table` does not reset SQLite's auto-increment counter. Factory resets must clear entries in the `sqlite_sequence` table for full cleanup. [Verified]
