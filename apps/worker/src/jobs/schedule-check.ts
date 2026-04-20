// Scheduled-Publish: flippt Videos mit fälligem scheduledPublishAt auf
// visibility=PUBLIC und erzeugt Subscriber-Notifications. Läuft als
// BullMQ-Cron alle 60 s (siehe index.ts).

import { prisma } from "@play/db";

export async function processScheduleCheck(): Promise<{ published: number }> {
  const now = new Date();
  const due = await prisma.video.findMany({
    where: {
      scheduledPublishAt: { lte: now },
      visibility: { not: "PUBLIC" },
      status: "LIVE",
    },
    select: {
      id: true,
      title: true,
      slug: true,
      channelId: true,
      ownerId: true,
    },
    take: 50,
  });
  if (due.length === 0) return { published: 0 };

  for (const v of due) {
    await prisma.$transaction(async (tx) => {
      await tx.video.update({
        where: { id: v.id },
        data: {
          visibility: "PUBLIC",
          publishedAt: now,
          scheduledPublishAt: null,
        },
      });
      const subs = await tx.subscription.findMany({
        where: { channelId: v.channelId, notify: true },
        select: { subscriberId: true },
      });
      if (subs.length > 0) {
        await tx.notification.createMany({
          data: subs.map((s) => ({
            userId: s.subscriberId,
            type: "NEW_UPLOAD" as const,
            title: `Neues Video: ${v.title}`,
            body: null,
            link: `/watch/${v.slug}`,
          })),
        });
      }
    });
  }
  return { published: due.length };
}
