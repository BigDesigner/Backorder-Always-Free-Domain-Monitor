import type { Env } from "./types";

export async function notifyAll(env: Env, message: string): Promise<void> {
  await Promise.allSettled([
    notifyTelegram(env, message),
    notifyDiscord(env, message),
  ]);
}

async function notifyTelegram(env: Env, message: string): Promise<void> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true
    })
  });
}

async function notifyDiscord(env: Env, message: string): Promise<void> {
  const hook = env.DISCORD_WEBHOOK_URL;
  if (!hook) return;
  await fetch(hook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ content: message })
  });
}
