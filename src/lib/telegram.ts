export interface TelegramMeetingAlert {
  id: string;
  title: string;
  scheduledAt?: string;
  startedAt?: string;
  duration?: number;
  password?: string;
  hostName?: string;
  batchName?: string | null;
  videoUrl?: string;
}

function getAppBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

/**
 * Low-level utility to send a message via Telegram Bot API
 */
export async function sendTelegramMessage(
  text: string,
  inlineButtons?: Array<{ text: string; url: string }>
): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    return false;
  }

  try {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: false,
    };

    if (inlineButtons && inlineButtons.length > 0) {
      payload.reply_markup = {
        inline_keyboard: [
          inlineButtons.map(btn => ({ text: btn.text, url: btn.url }))
        ]
      };
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    return Boolean(data?.ok);
  } catch (err) {
    console.warn('Telegram send message warning:', err);
    return false;
  }
}

/**
 * 1. Alert: Meeting / Class Scheduled
 */
export async function alertClassScheduled(m: TelegramMeetingAlert): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const joinUrl = `${baseUrl}/meetings/room/${encodeURIComponent(m.id)}`;

  let dateStr = 'TBD';
  if (m.scheduledAt) {
    try {
      dateStr = new Date(m.scheduledAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      });
    } catch {
      dateStr = m.scheduledAt;
    }
  }

  const batchText = m.batchName ? `\n📚 <b>Batch:</b> ${escapeHtml(m.batchName)}` : '';
  const mentorText = m.hostName ? `\n👨‍🏫 <b>Mentor:</b> ${escapeHtml(m.hostName)}` : '';
  const pwdText = m.password ? `\n🔒 <b>Password:</b> <code>${escapeHtml(m.password)}</code>` : '';

  const text = `📅 <b>NEW CLASS SCHEDULED!</b>
━━━━━━━━━━━━━━━━━━━━━${batchText}
 <b>Topic:</b> ${escapeHtml(m.title)}
 <b>Time:</b> ${dateStr}
 <b>Duration:</b> ${m.duration || 60} mins${mentorText}
 <b>Meeting ID:</b> <code>${escapeHtml(m.id)}</code>${pwdText}

Students enrolled in this batch can join using the link below:`;

  return sendTelegramMessage(text, [
    { text: '👉 View Class & Join', url: joinUrl }
  ]);
}

/**
 * 2. Alert: Mentor Started the Class (LIVE NOW)
 */
export async function alertClassLive(m: TelegramMeetingAlert): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const joinUrl = `${baseUrl}/meetings/room/${encodeURIComponent(m.id)}`;

  const mentorName = m.hostName || 'Your Mentor';
  const batchText = m.batchName ? `\n📚 <b>Batch:</b> ${escapeHtml(m.batchName)}` : '';
  const pwdText = m.password ? `\n🔒 <b>Password:</b> <code>${escapeHtml(m.password)}</code>` : '';

  const text = `🔴 <b>LIVE CLASS STARTED!</b>
━━━━━━━━━━━━━━━━━━━━━
 <b>${escapeHtml(mentorName)}</b> is live now in the classroom!${batchText}
 <b>Topic:</b> ${escapeHtml(m.title)}
 <b>Meeting ID:</b> <code>${escapeHtml(m.id)}</code>${pwdText}

The room is open. Click below to join immediately!`;

  return sendTelegramMessage(text, [
    { text: ' Join Live Class Now', url: joinUrl }
  ]);
}

/**
 * 3. Alert: Class Finished (Recording & Notes Available)
 */
export async function alertClassRecordingReady(m: TelegramMeetingAlert): Promise<boolean> {
  const baseUrl = getAppBaseUrl();
  const watchUrl = m.videoUrl || `${baseUrl}/library`;

  const batchText = m.batchName ? `\n <b>Batch:</b> ${escapeHtml(m.batchName)}` : '';

  const text = ` <b>CLASS RECORDING IS READY!</b>
━━━━━━━━━━━━━━━━━━━━━${batchText}
 <b>Session:</b> ${escapeHtml(m.title)}

Want to revise today's code, whiteboard, and discussion?
The recording has been transcoded and uploaded to cloud storage.`;

  return sendTelegramMessage(text, [
    { text: ' Watch Recording on RCRD', url: watchUrl }
  ]);
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
