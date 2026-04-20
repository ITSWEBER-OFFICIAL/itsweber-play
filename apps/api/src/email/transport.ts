// Lazy-Singleton-Nodemailer-Transporter.
//
// Die SMTP-Konfiguration liegt in der DB (`SmtpSettings`-Singleton, siehe
// packages/db/prisma/schema.prisma). Der Transporter wird beim ersten Versand
// aus den DB-Werten gebaut und ge-cached, bis ein Admin Settings ändert —
// dann ruft der admin.smtp.update-Handler `invalidateTransport()`.
//
// Bewusst nicht aus ENV gelesen: SMTP-Config soll via Admin-UI editierbar
// sein, ohne Container-Restart.

import nodemailer, { type Transporter } from "nodemailer";
import { prisma } from "@play/db";

type CachedTransport = {
  transporter: Transporter;
  fromName: string;
  fromAddress: string;
  configured: boolean;
};

let cached: CachedTransport | null = null;

export function invalidateTransport(): void {
  if (cached) {
    cached.transporter.close();
    cached = null;
  }
}

export async function getTransport(): Promise<CachedTransport> {
  if (cached) return cached;

  const settings = await prisma.smtpSettings
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);

  const configured = Boolean(settings?.host && settings?.fromAddress);

  if (!configured) {
    // Noop-Transporter für Dev-Bootstraps vor Admin-Konfiguration.
    // `sendMail` wird Fallback-Warning loggen (siehe send.ts).
    const transporter = nodemailer.createTransport({ jsonTransport: true });
    cached = {
      transporter,
      fromName: settings?.fromName ?? "ITSWEBER Play",
      fromAddress: settings?.fromAddress ?? "",
      configured: false,
    };
    return cached;
  }

  const s = settings!;
  const transporter = nodemailer.createTransport({
    host: s.host,
    port: s.port,
    secure: s.secure,
    auth:
      s.user && s.password
        ? { user: s.user, pass: s.password }
        : undefined,
  });

  cached = {
    transporter,
    fromName: s.fromName,
    fromAddress: s.fromAddress,
    configured: true,
  };
  return cached;
}

// Separater Pfad für Admin-Test-Button: baut Transporter aus übergebenen
// Werten (noch nicht persistiert), damit der Admin vor dem Speichern
// verifizieren kann.
export async function testTransport(opts: {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const transporter = nodemailer.createTransport({
    host: opts.host,
    port: opts.port,
    secure: opts.secure,
    auth:
      opts.user && opts.password
        ? { user: opts.user, pass: opts.password }
        : undefined,
  });
  try {
    await transporter.verify();
    transporter.close();
    return { ok: true };
  } catch (err) {
    transporter.close();
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
