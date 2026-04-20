// `sendMail` — zentraler Versand-Entrypoint.
//
// Liest Subject/HTML/Text aus der DB-Tabelle EmailTemplate (editierbar im Admin).
// Variablen werden per {{name}}-Syntax interpoliert.
// Bei fehlender SMTP-Config: console.warn-Fallback.

import { prisma } from "@play/db";
import { getTransport } from "./transport.js";
import { type TemplateName, type TemplateVars } from "./templates.js";
import { getDefaultTemplate } from "./template-defaults.js";

const PUBLIC_URL = process.env.PUBLIC_URL ?? "http://localhost:3000";

type DomainVars<T extends TemplateName> = Omit<TemplateVars[T], "siteName" | "siteUrl">;

function interpolate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export async function sendMail<T extends TemplateName>(opts: {
  to: string;
  template: T;
  vars: DomainVars<T>;
}): Promise<{ ok: true; messageId: string | null } | { ok: false; reason: string }> {
  const settings = await prisma.siteSettings
    .upsert({ where: { id: "singleton" }, update: {}, create: { id: "singleton" }, select: { siteName: true } })
    .catch(() => null);

  const siteName = settings?.siteName ?? "ITSWEBER Play";

  // DB-Template laden — bei fehlendem Eintrag Default erzeugen + speichern
  const defaults = getDefaultTemplate(opts.template);
  const dbTpl = await prisma.emailTemplate.upsert({
    where: { id: opts.template },
    update: {},
    create: { id: opts.template, subject: defaults.subject, htmlBody: defaults.htmlBody, textBody: defaults.textBody },
    select: { subject: true, htmlBody: true, textBody: true },
  });

  // Vars zusammenbauen + interpolieren
  const allVars: Record<string, string> = {
    siteName,
    siteUrl: PUBLIC_URL,
    ...(opts.vars as Record<string, unknown> as Record<string, string>),
  };
  // totalSubscribers kann number sein — in String konvertieren
  const stringVars = Object.fromEntries(Object.entries(allVars).map(([k, v]) => [k, String(v)]));

  const subject = interpolate(dbTpl.subject, stringVars);
  const html = interpolate(dbTpl.htmlBody, stringVars);
  const text = interpolate(dbTpl.textBody, stringVars);

  const { transporter, fromName, fromAddress, configured } = await getTransport();

  if (!configured) {
    console.warn(`[email] SMTP nicht konfiguriert — würde „${subject}" an ${opts.to} senden. Admin-UI: /admin/settings (Tab E-Mail).`);
    return { ok: false, reason: "SMTP nicht konfiguriert" };
  }

  try {
    const info = await transporter.sendMail({
      from: fromName ? `"${fromName}" <${fromAddress}>` : fromAddress,
      to: opts.to,
      subject,
      html,
      text,
    });
    return { ok: true, messageId: info.messageId ?? null };
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    console.error(`[email] Versand fehlgeschlagen (${opts.template} → ${opts.to}): ${reason}`);
    return { ok: false, reason };
  }
}
