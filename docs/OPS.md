# Ops Notes

## Rate limits
RDAP servers vary. This app defaults to **hourly checks** and uses **adaptive backoff**:
- 429: 6h → 12h → 24h
- errors: 2h → 6h → 12h

If you still see frequent 429s, set interval to 120m or 240m per domain.

## Notifications (free)
- Telegram: bot token + chat id
- Discord: webhook url

## Security
- Cookie is Secure + HttpOnly + SameSite=Lax (requires HTTPS)
- You can restrict CORS origins in `worker/src/index.ts`.

## RDAP Base
Default: `https://rdap.org/domain/`

If you want to use a different RDAP endpoint, set secret `RDAP_BASE`.
