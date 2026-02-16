export type Env = {
  DB: D1Database;
  ADMIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  DISCORD_WEBHOOK_URL?: string;
  RDAP_BASE?: string;
};

export type DomainRow = {
  id: number;
  domain: string;
  label: string | null;
  enabled: number;
  check_interval_min: number;
  next_check_at: number;
  last_checked_at: number | null;
  last_status: string | null;
  last_rdap_http: number | null;
  last_error: string | null;
  consecutive_errors: number;
  created_at: number;
};

export type EventRow = {
  id: number;
  domain_id: number | null;
  type: string;
  message: string;
  created_at: number;
};
