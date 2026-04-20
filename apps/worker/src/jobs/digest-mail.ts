// Täglicher Digest: an User mit notificationPrefs.digestDaily=true eine
// Zusammenfassung der seit dem letzten Lauf (Fenster 24 h) veröffentlichten
// Videos ihrer abonnierten Kanäle schicken. Läuft als BullMQ-Cron um 18:00.

import { prisma } from "@play/db";

interface NotificationPrefs {
  emailOnComment?: boolean;
  emailOnSubscriber?: boolean;
  digestDaily?: boolean;
  autoCaptions?: boolean;
}

type SendMailFn = (args: {
  to: string;
  subject: string;
  html: string;
  text: string;
}) => Promise<void>;

function extractPrefs(raw: unknown): NotificationPrefs {
  if (raw && typeof raw === "object") return raw as NotificationPrefs;
  return {};
}

// Der Worker kennt `send` nicht direkt (im API-Package). Wir injizieren die
// Send-Funktion per Parameter — index.ts darf auch ohne Mailer laufen.
export async function processDigestMail(
  sendMail?: SendMailFn,
): Promise<{ sent: number; candidates: number }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const users = await prisma.user.findMany({
    where: { banned: false },
    select: {
      id: true,
      email: true,
      displayName: true,
      notificationPrefs: true,
    },
  });
  const eligible = users.filter(
    (u) => extractPrefs(u.notificationPrefs).digestDaily === true && u.email,
  );
  if (eligible.length === 0) return { sent: 0, candidates: 0 };

  let sent = 0;
  for (const u of eligible) {
    const subs = await prisma.subscription.findMany({
      where: { subscriberId: u.id },
      select: { channelId: true },
    });
    if (subs.length === 0) continue;
    const channelIds = subs.map((s) => s.channelId);
    const newVideos = await prisma.video.findMany({
      where: {
        channelId: { in: channelIds },
        visibility: "PUBLIC",
        status: "LIVE",
        publishedAt: { gte: since },
      },
      orderBy: { publishedAt: "desc" },
      take: 20,
      select: {
        id: true,
        title: true,
        slug: true,
        publishedAt: true,
        channel: { select: { displayName: true, slug: true } },
      },
    });
    if (newVideos.length === 0) continue;

    const lines = newVideos
      .map(
        (v) =>
          `• ${v.title} — ${v.channel.displayName} (/watch/${v.slug})`,
      )
      .join("\n");
    const htmlList = newVideos
      .map(
        (v) =>
          `<li><a href="/watch/${v.slug}">${v.title}</a> — ${v.channel.displayName}</li>`,
      )
      .join("");

    if (sendMail) {
      try {
        await sendMail({
          to: u.email,
          subject: `Dein ITSWEBER-Play-Digest (${newVideos.length} neue Videos)`,
          text: `Hallo ${u.displayName},\n\nseit gestern sind ${newVideos.length} neue Videos bei Kanälen erschienen, denen du folgst:\n\n${lines}\n\n— ITSWEBER Play`,
          html: `<p>Hallo ${u.displayName},</p><p>seit gestern sind <strong>${newVideos.length} neue Videos</strong> bei Kanälen erschienen, denen du folgst:</p><ul>${htmlList}</ul><p>— ITSWEBER Play</p>`,
        });
        sent++;
      } catch {
        // silent — nächster Lauf holt nach
      }
    }
  }
  return { sent, candidates: eligible.length };
}
