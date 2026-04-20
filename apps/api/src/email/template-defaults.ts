// Default-Inhalte für jedes System-Template.
// Wird beim ersten admin.emailTemplates.list-Abruf per upsert in die DB geschrieben.
// Danach bearbeitet der Admin die Row — send.ts liest immer aus DB.
//
// Variablen-Syntax: {{variablenName}} — wird vor dem Senden interpoliert.
// Verfügbare Variablen pro Template sind in TEMPLATE_META definiert.

import {
  welcomeTemplate,
  emailVerifyTemplate,
  passwordResetTemplate,
  commentNotifyTemplate,
  subscriberNotifyTemplate,
  takedownNotifyTemplate,
  type TemplateName,
} from "./templates.js";

export type TemplateVar = {
  name: string;       // z.B. "displayName"
  description: string; // Tooltip im Editor
  example: string;    // Für Live-Preview
};

export type TemplateMeta = {
  id: TemplateName;
  label: string;        // Anzeigename im Admin
  description: string;  // Kurzbeschreibung
  vars: TemplateVar[];
};

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "welcome",
    label: "Willkommens-Mail",
    description: "Wird nach erfolgreicher Registrierung gesendet.",
    vars: [
      { name: "displayName", description: "Anzeigename des Users", example: "Max Mustermann" },
      { name: "handle", description: "Handle des Users (ohne @)", example: "max" },
      { name: "siteName", description: "Name der Plattform", example: "ITSWEBER Play" },
      { name: "siteUrl", description: "URL der Plattform", example: "https://play.itsweber.net" },
    ],
  },
  {
    id: "email-verify",
    label: "E-Mail-Bestätigung",
    description: "Enthält den Bestätigungs-Link nach der Registrierung.",
    vars: [
      { name: "displayName", description: "Anzeigename des Users", example: "Max Mustermann" },
      { name: "verifyUrl", description: "Bestätigungs-Link", example: "https://play.itsweber.net/auth/verify-email?token=abc123" },
      { name: "siteName", description: "Name der Plattform", example: "ITSWEBER Play" },
      { name: "siteUrl", description: "URL der Plattform", example: "https://play.itsweber.net" },
    ],
  },
  {
    id: "password-reset",
    label: "Passwort-Reset",
    description: "Enthält den Reset-Link wenn ein User sein Passwort zurücksetzen will.",
    vars: [
      { name: "displayName", description: "Anzeigename des Users", example: "Max Mustermann" },
      { name: "resetUrl", description: "Reset-Link", example: "https://play.itsweber.net/auth/reset-password?token=abc123" },
      { name: "siteName", description: "Name der Plattform", example: "ITSWEBER Play" },
      { name: "siteUrl", description: "URL der Plattform", example: "https://play.itsweber.net" },
    ],
  },
  {
    id: "comment-notify",
    label: "Kommentar-Benachrichtigung",
    description: "Wird gesendet wenn jemand auf einen Kommentar antwortet.",
    vars: [
      { name: "recipientName", description: "Empfänger-Name", example: "Max Mustermann" },
      { name: "authorName", description: "Name des Kommentators", example: "Anna Schmidt" },
      { name: "videoTitle", description: "Titel des Videos", example: "Mein erstes Video" },
      { name: "videoUrl", description: "URL des Videos", example: "https://play.itsweber.net/watch/abc123" },
      { name: "commentExcerpt", description: "Ausschnitt des Kommentars", example: "Sehr gutes Video, danke!" },
      { name: "siteName", description: "Name der Plattform", example: "ITSWEBER Play" },
      { name: "siteUrl", description: "URL der Plattform", example: "https://play.itsweber.net" },
    ],
  },
  {
    id: "subscriber-notify",
    label: "Neuer Abonnent",
    description: "Wird gesendet wenn ein User einen Kanal abonniert.",
    vars: [
      { name: "recipientName", description: "Empfänger-Name (Kanal-Inhaber)", example: "Max Mustermann" },
      { name: "subscriberName", description: "Name des neuen Abonnenten", example: "Anna Schmidt" },
      { name: "channelUrl", description: "URL des Kanals", example: "https://play.itsweber.net/c/max" },
      { name: "totalSubscribers", description: "Gesamt-Abonnenten-Anzahl", example: "42" },
      { name: "siteName", description: "Name der Plattform", example: "ITSWEBER Play" },
      { name: "siteUrl", description: "URL der Plattform", example: "https://play.itsweber.net" },
    ],
  },
  {
    id: "takedown-notify",
    label: "Video-Takedown",
    description: "Wird gesendet wenn ein Video durch die Moderation entfernt wird.",
    vars: [
      { name: "recipientName", description: "Empfänger-Name (Video-Inhaber)", example: "Max Mustermann" },
      { name: "videoTitle", description: "Titel des entfernten Videos", example: "Mein Video" },
      { name: "reason", description: "Begründung der Moderation", example: "Verstößt gegen die Community-Richtlinien." },
      { name: "contactEmail", description: "Kontakt-E-Mail für Widerspruch", example: "hallo@itsweber.net" },
      { name: "siteName", description: "Name der Plattform", example: "ITSWEBER Play" },
      { name: "siteUrl", description: "URL der Plattform", example: "https://play.itsweber.net" },
    ],
  },
];

const EXAMPLE_BASE = { siteName: "ITSWEBER Play", siteUrl: "https://play.itsweber.net" };

// Generiert den initialen DB-Eintrag für ein Template.
export function getDefaultTemplate(id: TemplateName): { subject: string; htmlBody: string; textBody: string } {
  const exampleVars: Record<TemplateName, object> = {
    "welcome": { ...EXAMPLE_BASE, displayName: "Admin", handle: "admin" },
    "email-verify": { ...EXAMPLE_BASE, displayName: "Admin", verifyUrl: "https://play.itsweber.net/auth/verify-email?token=EXAMPLE" },
    "password-reset": { ...EXAMPLE_BASE, displayName: "Admin", resetUrl: "https://play.itsweber.net/auth/reset-password?token=EXAMPLE" },
    "comment-notify": { ...EXAMPLE_BASE, recipientName: "Admin", authorName: "Nutzer", videoTitle: "Beispiel-Video", videoUrl: "https://play.itsweber.net/watch/example", commentExcerpt: "Toller Beitrag!" },
    "subscriber-notify": { ...EXAMPLE_BASE, recipientName: "Admin", subscriberName: "Neuer Nutzer", channelUrl: "https://play.itsweber.net/c/admin", totalSubscribers: 1 },
    "takedown-notify": { ...EXAMPLE_BASE, recipientName: "Admin", videoTitle: "Beispiel-Video", reason: "Community-Richtlinien", contactEmail: "hallo@itsweber.net" },
  };
  const builders = {
    "welcome": welcomeTemplate,
    "email-verify": emailVerifyTemplate,
    "password-reset": passwordResetTemplate,
    "comment-notify": commentNotifyTemplate,
    "subscriber-notify": subscriberNotifyTemplate,
    "takedown-notify": takedownNotifyTemplate,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tpl = (builders[id] as (v: any) => { subject: string; html: string; text: string })(exampleVars[id]);
  return { subject: tpl.subject, htmlBody: tpl.html, textBody: tpl.text };
}
