// Globale Plattform-Einstellungen. `get` ist public, damit der SiteHeader
// per SSR den siteName/Tagline rendern kann; `update` ist admin-only.
// Singleton-Row wie ThemeSettings (id="singleton").

import { z } from "zod";
import { router, publicProcedure, adminProcedure } from "../init";

const RegistrationModeEnum = z.enum(["OPEN", "INVITE", "CLOSED"]);
const VisibilityEnum = z.enum(["PUBLIC", "UNLISTED", "PRIVATE", "LOGGED_IN"]);

export const siteSettingsRouter = router({
  get: publicProcedure.query(async ({ ctx }) => {
    return ctx.prisma.siteSettings.upsert({
      where: { id: "singleton" },
      update: {},
      create: { id: "singleton" },
    });
  }),

  update: adminProcedure
    .input(
      z.object({
        siteName: z.string().trim().min(1).max(80).optional(),
        siteTagline: z.string().trim().max(200).optional(),
        contactEmail: z
          .union([z.string().email(), z.literal("")])
          .optional(),
        defaultLocale: z.enum(["de", "en"]).optional(),
        registrationMode: RegistrationModeEnum.optional(),
        defaultVisibility: VisibilityEnum.optional(),
        defaultCommentsEnabled: z.boolean().optional(),
        defaultCategoryId: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const userId = (ctx.session.user as { id: string }).id;
      const data: Record<string, unknown> = { updatedBy: userId };
      for (const [k, v] of Object.entries(input)) {
        if (v !== undefined) data[k] = v;
      }
      return ctx.prisma.siteSettings.upsert({
        where: { id: "singleton" },
        update: data as never,
        create: { id: "singleton", ...data } as never,
      });
    }),
});
