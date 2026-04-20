// E-Mail-Templates als reine Funktionen: (vars) => { subject, html, text }.
//
// Design-Sprache: spiegelt das ITSWEBER-Brand-Preset — dunkles Navy (#0A1A26)
// als Hintergrund, Atom-Grün (#3FE48B) als CTA-Akzent. Inline-Styles weil
// Mail-Clients CSS-Classes unterschiedlich handhaben; Struktur mit
// Table-Layout, damit Outlook/Gmail/Apple-Mail konsistent rendern.
//
// Jedes Template erzeugt HTML + Plain-Text. Text wird für Spamfilter-Scoring
// und Accessibility gebraucht (Screen-Reader, Text-Only-Clients).

const BRAND_NAVY = "#0A1A26";
const BRAND_NAVY_SOFT = "#102838";
const BRAND_ACCENT = "#3FE48B";
const BRAND_ACCENT_HOVER = "#2EBF6E";
const NEUTRAL_LIGHT = "#F0F6F9";
const NEUTRAL_MUTED = "#7AA9BA";
const NEUTRAL_BORDER = "#1B3F50";

export type MailTemplate = {
  subject: string;
  html: string;
  text: string;
};

type BaseVars = {
  siteName: string;
  siteUrl: string;
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function layout(opts: {
  siteName: string;
  siteUrl: string;
  heading: string;
  intro: string;
  // Array, damit Templates mehrere Paragraphen + optionale CTA-Blöcke stapeln.
  blocks: Array<
    | { type: "paragraph"; text: string }
    | { type: "cta"; label: string; href: string }
    | { type: "code"; value: string; label?: string }
    | { type: "hint"; text: string }
  >;
  footerNote?: string;
}): string {
  const year = new Date().getFullYear();
  const bodyBlocks = opts.blocks
    .map((block) => {
      if (block.type === "paragraph") {
        return `<p style="margin:0 0 18px 0;color:${NEUTRAL_LIGHT};font-size:15px;line-height:1.65;">${block.text}</p>`;
      }
      if (block.type === "cta") {
        return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:8px 0 24px 0;"><tr><td style="border-radius:10px;background:${BRAND_ACCENT};box-shadow:0 0 18px rgba(63,228,139,0.45);"><a href="${block.href}" style="display:inline-block;padding:14px 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:${BRAND_NAVY};text-decoration:none;border-radius:10px;">${block.label} →</a></td></tr></table>`;
      }
      if (block.type === "code") {
        return `<div style="margin:0 0 18px 0;"><div style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${NEUTRAL_MUTED};margin-bottom:6px;">${escapeHtml(block.label ?? "Link")}</div><div style="padding:12px 16px;border-radius:8px;background:${BRAND_NAVY};border:1px solid ${NEUTRAL_BORDER};font-family:'SFMono-Regular',Consolas,Monaco,monospace;font-size:12px;color:${NEUTRAL_LIGHT};word-break:break-all;">${block.value}</div></div>`;
      }
      return `<div style="margin:0 0 18px 0;padding:14px 18px;border-left:3px solid ${BRAND_ACCENT};background:${BRAND_NAVY};border-radius:0 8px 8px 0;color:${NEUTRAL_LIGHT};font-size:13px;line-height:1.6;">${block.text}</div>`;
    })
    .join("");

  const footerNote = opts.footerNote
    ? `<p style="margin:0 0 10px 0;color:${NEUTRAL_MUTED};font-size:12px;line-height:1.6;">${opts.footerNote}</p>`
    : "";

  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(opts.heading)}</title></head><body style="margin:0;padding:0;background:${BRAND_NAVY};font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background:${BRAND_NAVY};"><tr><td align="center" style="padding:32px 16px;"><table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;background:${BRAND_NAVY_SOFT};border:1px solid ${NEUTRAL_BORDER};border-radius:16px;overflow:hidden;"><tr><td style="padding:28px 32px;border-bottom:1px solid ${NEUTRAL_BORDER};"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td style="vertical-align:middle;"><span style="display:inline-block;width:32px;height:32px;border-radius:8px;background:${BRAND_ACCENT};box-shadow:0 0 16px rgba(63,228,139,0.5);text-align:center;line-height:32px;font-weight:900;color:${BRAND_NAVY};font-size:16px;">▶</span></td><td style="vertical-align:middle;padding-left:12px;"><div style="font-size:16px;font-weight:700;color:${NEUTRAL_LIGHT};letter-spacing:-0.01em;">${escapeHtml(opts.siteName)}</div></td></tr></table></td></tr><tr><td style="padding:32px;"><h1 style="margin:0 0 12px 0;font-size:22px;font-weight:800;color:${NEUTRAL_LIGHT};letter-spacing:-0.02em;line-height:1.25;">${escapeHtml(opts.heading)}</h1><p style="margin:0 0 22px 0;color:${NEUTRAL_MUTED};font-size:14px;line-height:1.6;">${opts.intro}</p>${bodyBlocks}</td></tr><tr><td style="padding:20px 32px;border-top:1px solid ${NEUTRAL_BORDER};background:${BRAND_NAVY};">${footerNote}<p style="margin:0;color:${NEUTRAL_MUTED};font-size:11px;line-height:1.6;">© ${year} ${escapeHtml(opts.siteName)} · <a href="${opts.siteUrl}" style="color:${NEUTRAL_MUTED};text-decoration:underline;">${opts.siteUrl.replace(/^https?:\/\//, "")}</a></p></td></tr></table></td></tr></table></body></html>`;
}

// ─── welcome ────────────────────────────────────────────────────────────
export function welcomeTemplate(vars: BaseVars & { displayName: string; handle: string }): MailTemplate {
  const subject = `Willkommen auf ${vars.siteName}, ${vars.displayName}!`;
  const studioUrl = `${vars.siteUrl}/studio`;
  const channelUrl = `${vars.siteUrl}/c/${vars.handle}`;
  const html = layout({
    siteName: vars.siteName,
    siteUrl: vars.siteUrl,
    heading: `Willkommen, ${escapeHtml(vars.displayName)}.`,
    intro: `Dein Account ist bereit — dein Kanal ist angelegt, du kannst direkt loslegen.`,
    blocks: [
      { type: "paragraph", text: `Dein Handle: <strong style="color:${BRAND_ACCENT};">@${escapeHtml(vars.handle)}</strong>` },
      { type: "paragraph", text: `Im Studio lädst du Videos hoch, importierst aus YouTube oder bearbeitest bestehende Uploads. Deine Kanal-Seite ist öffentlich erreichbar:` },
      { type: "cta", label: "Zum Studio", href: studioUrl },
      { type: "code", value: channelUrl, label: "Dein Kanal" },
    ],
    footerNote: `Du hast dich mit dieser Adresse registriert. Falls das nicht du warst, kannst du diese Nachricht ignorieren — wir löschen den Account nach 24 h ohne Bestätigung automatisch.`,
  });
  const text = `Willkommen, ${vars.displayName}!\n\nDein Account auf ${vars.siteName} ist bereit.\nDein Handle: @${vars.handle}\n\nZum Studio: ${studioUrl}\nDein Kanal: ${channelUrl}\n`;
  return { subject, html, text };
}

// ─── email-verify ───────────────────────────────────────────────────────
export function emailVerifyTemplate(vars: BaseVars & { verifyUrl: string; displayName: string }): MailTemplate {
  const subject = `Bestätige deine E-Mail-Adresse`;
  const html = layout({
    siteName: vars.siteName,
    siteUrl: vars.siteUrl,
    heading: "Fast geschafft — E-Mail bestätigen",
    intro: `Hallo ${escapeHtml(vars.displayName)}, bitte bestätige diese Adresse, damit wir dich erreichen können.`,
    blocks: [
      { type: "cta", label: "E-Mail bestätigen", href: vars.verifyUrl },
      { type: "code", value: vars.verifyUrl, label: "Link (falls der Button nicht funktioniert)" },
      { type: "hint", text: `Der Link ist 24 Stunden gültig. Falls du diese Bestätigung nicht angefordert hast, ignoriere diese E-Mail.` },
    ],
  });
  const text = `Hallo ${vars.displayName},\n\nBitte bestätige deine E-Mail-Adresse auf ${vars.siteName}:\n\n${vars.verifyUrl}\n\nDer Link ist 24 Stunden gültig.\n`;
  return { subject, html, text };
}

// ─── password-reset ─────────────────────────────────────────────────────
export function passwordResetTemplate(vars: BaseVars & { resetUrl: string; displayName: string }): MailTemplate {
  const subject = `Passwort zurücksetzen`;
  const html = layout({
    siteName: vars.siteName,
    siteUrl: vars.siteUrl,
    heading: "Passwort zurücksetzen",
    intro: `Hallo ${escapeHtml(vars.displayName)}, du hast eine Passwort-Rücksetzung angefordert.`,
    blocks: [
      { type: "paragraph", text: `Klick auf den Button, um ein neues Passwort zu vergeben. Dein altes Passwort bleibt aktiv, bis du ein neues speicherst.` },
      { type: "cta", label: "Neues Passwort wählen", href: vars.resetUrl },
      { type: "code", value: vars.resetUrl, label: "Link (falls der Button nicht funktioniert)" },
      { type: "hint", text: `Der Link ist 60 Minuten gültig. Falls du keine Rücksetzung angefordert hast, ignoriere diese Nachricht — dein Account bleibt unverändert.` },
    ],
  });
  const text = `Hallo ${vars.displayName},\n\nDu hast eine Passwort-Rücksetzung auf ${vars.siteName} angefordert.\n\nNeues Passwort setzen:\n${vars.resetUrl}\n\nDer Link ist 60 Minuten gültig.\n`;
  return { subject, html, text };
}

// ─── comment-notify ─────────────────────────────────────────────────────
export function commentNotifyTemplate(vars: BaseVars & {
  recipientName: string;
  authorName: string;
  videoTitle: string;
  videoUrl: string;
  commentExcerpt: string;
}): MailTemplate {
  const subject = `Neue Antwort: „${vars.videoTitle}"`;
  const excerpt = vars.commentExcerpt.length > 240
    ? vars.commentExcerpt.slice(0, 240) + "…"
    : vars.commentExcerpt;
  const html = layout({
    siteName: vars.siteName,
    siteUrl: vars.siteUrl,
    heading: `${escapeHtml(vars.authorName)} hat auf deinen Kommentar geantwortet`,
    intro: `Hallo ${escapeHtml(vars.recipientName)}, es gibt eine neue Antwort unter „${escapeHtml(vars.videoTitle)}".`,
    blocks: [
      { type: "hint", text: `„${escapeHtml(excerpt)}"` },
      { type: "cta", label: "Antwort ansehen", href: vars.videoUrl },
    ],
    footerNote: `Du bekommst diese Mail, weil du E-Mail-Benachrichtigungen für Kommentar-Antworten aktiviert hast. Du kannst das unter „Einstellungen → Benachrichtigungen" abschalten.`,
  });
  const text = `Hallo ${vars.recipientName},\n\n${vars.authorName} hat auf deinen Kommentar unter „${vars.videoTitle}" geantwortet:\n\n„${excerpt}"\n\n${vars.videoUrl}\n`;
  return { subject, html, text };
}

// ─── subscriber-notify ──────────────────────────────────────────────────
export function subscriberNotifyTemplate(vars: BaseVars & {
  recipientName: string;
  subscriberName: string;
  channelUrl: string;
  totalSubscribers: number;
}): MailTemplate {
  const subject = `Neuer Abonnent: ${vars.subscriberName}`;
  const html = layout({
    siteName: vars.siteName,
    siteUrl: vars.siteUrl,
    heading: `${escapeHtml(vars.subscriberName)} abonniert dich jetzt`,
    intro: `Hallo ${escapeHtml(vars.recipientName)}, ein neuer Abonnent ist dazugekommen.`,
    blocks: [
      { type: "paragraph", text: `Du hast jetzt <strong style="color:${BRAND_ACCENT};">${vars.totalSubscribers}</strong> Abonnent${vars.totalSubscribers === 1 ? "en" : "en"}.` },
      { type: "cta", label: "Kanal öffnen", href: vars.channelUrl },
    ],
    footerNote: `Du bekommst diese Mail, weil du E-Mail-Benachrichtigungen für neue Abonnenten aktiviert hast. Du kannst das unter „Einstellungen → Benachrichtigungen" abschalten.`,
  });
  const text = `Hallo ${vars.recipientName},\n\n${vars.subscriberName} abonniert dich jetzt. Du hast jetzt ${vars.totalSubscribers} Abonnenten.\n\n${vars.channelUrl}\n`;
  return { subject, html, text };
}

// ─── takedown-notify ────────────────────────────────────────────────────
export function takedownNotifyTemplate(vars: BaseVars & {
  recipientName: string;
  videoTitle: string;
  reason: string;
  contactEmail: string;
}): MailTemplate {
  const subject = `Dein Video wurde entfernt: „${vars.videoTitle}"`;
  const html = layout({
    siteName: vars.siteName,
    siteUrl: vars.siteUrl,
    heading: `Video entfernt: „${escapeHtml(vars.videoTitle)}"`,
    intro: `Hallo ${escapeHtml(vars.recipientName)}, wir haben dein Video nach einer Moderations-Entscheidung offline genommen.`,
    blocks: [
      { type: "paragraph", text: `<strong style="color:${NEUTRAL_LIGHT};">Grund:</strong> ${escapeHtml(vars.reason)}` },
      { type: "paragraph", text: `Das Original bleibt für dich im Studio einsehbar, ist aber nicht mehr öffentlich abrufbar.` },
      { type: "hint", text: `Wenn du die Entscheidung für falsch hältst, antworte auf diese Mail an <a href="mailto:${vars.contactEmail}" style="color:${BRAND_ACCENT};">${escapeHtml(vars.contactEmail)}</a>.` },
    ],
  });
  const text = `Hallo ${vars.recipientName},\n\nDein Video „${vars.videoTitle}" wurde nach einer Moderations-Entscheidung entfernt.\n\nGrund: ${vars.reason}\n\nWiderspruch: ${vars.contactEmail}\n`;
  return { subject, html, text };
}

// ─── Registry ───────────────────────────────────────────────────────────
// Wird von `send.ts` verwendet, um den richtigen Template-Builder zu wählen.

export type TemplateName =
  | "welcome"
  | "email-verify"
  | "password-reset"
  | "comment-notify"
  | "subscriber-notify"
  | "takedown-notify";

export type TemplateVars = {
  "welcome": Parameters<typeof welcomeTemplate>[0];
  "email-verify": Parameters<typeof emailVerifyTemplate>[0];
  "password-reset": Parameters<typeof passwordResetTemplate>[0];
  "comment-notify": Parameters<typeof commentNotifyTemplate>[0];
  "subscriber-notify": Parameters<typeof subscriberNotifyTemplate>[0];
  "takedown-notify": Parameters<typeof takedownNotifyTemplate>[0];
};

export const TEMPLATES = {
  "welcome": welcomeTemplate,
  "email-verify": emailVerifyTemplate,
  "password-reset": passwordResetTemplate,
  "comment-notify": commentNotifyTemplate,
  "subscriber-notify": subscriberNotifyTemplate,
  "takedown-notify": takedownNotifyTemplate,
} as const;
