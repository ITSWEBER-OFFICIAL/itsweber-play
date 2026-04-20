import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Hilfe & Glossar — ITSWEBER Play",
  description: "Alle Begriffe und Features der Plattform erklärt.",
};

interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  links?: { label: string; href: string }[];
}

const ENTRIES: GlossaryEntry[] = [
  {
    id: "format",
    term: "Format: Video vs. Short",
    definition:
      "ITSWEBER Play kennt zwei Video-Formate. Video (Long-Form) sind Querformat-Videos ohne Längenbeschränkung — sie erscheinen im normalen Feed auf der Startseite und in Suchergebnissen. Shorts sind vertikale Videos im 9:16-Format, typischerweise unter 60 Sekunden, und erscheinen im /shorts-Karussell. Der Worker erkennt das Format automatisch anhand von Aspect-Ratio und Dauer, du kannst es aber im Editor manuell überschreiben.",
    links: [{ label: "Studio Upload", href: "/studio/upload" }],
  },
  {
    id: "visibility",
    term: "Sichtbarkeit",
    definition:
      "Jedes Video und jede Playlist hat eine Sichtbarkeits-Einstellung. Public: für alle sichtbar und im Feed auffindbar. Unlisted (Nicht gelistet): nicht im Feed, aber über den direkten Link erreichbar — ideal für Beta-Previews. Login: nur für eingeloggte User sichtbar. Privat: nur du als Creator siehst das Video.",
  },
  {
    id: "channel",
    term: "Kanal",
    definition:
      "Ein Kanal ist die öffentliche Seite eines Creators. Du kannst deinen Kanal mit einem Banner, einem Avatar, einer Accent-Farbe und einem About-Text personalisieren. Jeder registrierte User bekommt beim ersten Login automatisch einen Kanal angelegt. Ein Admin kann mehrere Kanäle auf einer Instanz betreiben.",
    links: [{ label: "Mein Kanal", href: "/studio/channel" }],
  },
  {
    id: "short",
    term: "Short",
    definition:
      "Shorts sind vertikale Kurzvideos (9:16, max. 60 s). Sie werden separat vom normalen Video-Feed verwaltet und erscheinen auf /shorts im Vollbild-Karussell. Creator koennen beim Upload manuell 'Short' waehlen - der Worker erkennt das Format aber auch automatisch anhand von Hoehe > Breite und Dauer <= 60 s.",
    links: [{ label: "Shorts-Feed", href: "/shorts" }],
  },
  {
    id: "playlist",
    term: "Playlist",
    definition:
      "Eine Playlist fasst mehrere Videos in einer geordneten Liste zusammen. Playlists können öffentlich oder privat sein. Öffentliche Playlists erscheinen auf dem Kanal-Profil und haben eine eigene URL (/playlist/[slug]). Creator verwalten ihre Playlists unter Studio > Playlists.",
    links: [{ label: "Playlists verwalten", href: "/studio/playlists" }],
  },
  {
    id: "tags",
    term: "Tags",
    definition:
      "Tags sind Stichworte für ein Video (max. 20 Tags, je max. 40 Zeichen, Komma-separiert im Editor). Sie werden für die Volltextsuche und die Kategoriefilterung genutzt. Tags mit gleicher Schreibweise können zukünftig klickbar sein und zu einer Tag-Seite führen.",
  },
  {
    id: "captions",
    term: "Captions (Untertitel)",
    definition:
      "Captions sind textbasierte Untertitel für ein Video. ITSWEBER Play unterstützt das WebVTT-Format. Du kannst manuell eine .vtt- oder .srt-Datei hochladen oder — wenn der Admin die Funktion aktiviert hat — automatische Captions via Whisper-KI generieren lassen. Automatisch generierte Captions sind im Studio bearbeitbar und werden mit einem entsprechenden Badge gekennzeichnet.",
    links: [{ label: "Editor", href: "/studio" }],
  },
  {
    id: "subscribe",
    term: "Abonnieren / Subscribe",
    definition:
      "Mit einem Klick auf den Subscribe-Button folgst du einem Kanal. Neue Videos des Kanals erscheinen dann unter /subs (Abonnements). Zusätzlich kannst du die Bell-Benachrichtigung aktivieren: dann erhältst du eine In-App-Benachrichtigung, wenn ein neues Video veröffentlicht wird.",
  },
  {
    id: "import",
    term: "Import (URL)",
    definition:
      "Statt eine Datei hochzuladen kannst du auch eine Video-URL angeben — etwa von YouTube, Vimeo oder anderen yt-dlp-kompatiblen Plattformen. Der Worker lädt das Video im Hintergrund herunter und transkodiert es zu HLS. Das ursprüngliche Hosting-Anbieter-Video wird dabei nicht verändert.",
    links: [{ label: "Studio Import", href: "/studio/import" }],
  },
  {
    id: "report",
    term: "Melden (Report)",
    definition:
      "Mit dem Flag-Button kannst du ein Video oder einen Kommentar als problematisch melden. Reports gehen in die Admin-Warteschlange. Admins können gemeldete Inhalte überprüfen, ausblenden oder löschen. Missbrauch des Meldesystems kann zur Sperrung führen.",
  },
  {
    id: "registration",
    term: "Registrierungs-Modus",
    definition:
      "Der Admin kann den Registrierungs-Modus der Plattform steuern. OPEN: jede Person kann sich registrieren. INVITE: Registrierung gesperrt, nur über Einladungs-Tokens (kommt in v0.3). CLOSED: keine neuen Accounts möglich — bestehende User sind nicht betroffen.",
    links: [{ label: "Admin-Einstellungen", href: "/admin/settings" }],
  },
  {
    id: "featured",
    term: "Featured-Video",
    definition:
      "Creator koennen auf ihrer Kanalseite ein einzelnes Video als 'Featured' pinnen. Es erscheint prominent am Anfang des Kanal-Profils, z. B. als Kanaltrailer. Das Featured-Video kann ein anderes als das neueste Video sein.",
  },
  {
    id: "theme",
    term: "Theme & Design-Tokens",
    definition:
      "ITSWEBER Play besitzt ein 6-Ebenen-Design-Token-System. Admins können über Admin > Erscheinungsbild die Farben, das Logo und Custom-CSS der gesamten Plattform anpassen. Creator können zusätzlich eine eigene Accent-Farbe für ihren Kanal setzen, die den Subscribe-Button und Kanal-spezifische Akzente färbt.",
    links: [{ label: "Admin-Themes", href: "/admin/appearance" }],
  },
  {
    id: "hls",
    term: "HLS (HTTP Live Streaming)",
    definition:
      "Nach dem Upload transkodiert der Worker dein Video in das HLS-Format (HTTP Live Streaming). HLS teilt das Video in kleine Segmente auf und liefert sie adaptiv — je nach Bandbreite des Zuschauers in unterschiedlicher Qualität. Das sorgt für flüssiges Streaming ohne Puffern. Die Transcoding-Dauer hängt von der Videolänge und den Server-Ressourcen ab.",
  },
  {
    id: "smtp",
    term: "SMTP (E-Mail-Versand)",
    definition:
      "Admins konfigurieren unter Admin > Einstellungen > E-Mail einen SMTP-Server für den Versand von System-Mails: Registrierungsbestätigung, Passwort-Reset und Willkommens-Mail. Ohne SMTP-Konfiguration loggt der Server die Mails in die Konsole (Fallback).",
    links: [{ label: "Admin-Einstellungen", href: "/admin/settings" }],
  },
];

const SECTIONS = [
  { title: "Videos & Formate", ids: ["format", "short", "hls", "captions", "tags", "import"] },
  { title: "Kanäle & Creator", ids: ["channel", "playlist", "featured", "subscribe"] },
  { title: "Community", ids: ["report"] },
  { title: "Admin & Plattform", ids: ["registration", "smtp", "theme"] },
];

export default function HelpPage() {
  const entryMap = new Map(ENTRIES.map((e) => [e.id, e]));

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 space-y-10" id="main">
      <header className="space-y-3">
        <p className="text-sm font-medium" style={{ color: "var(--color-brand)" }}>
          ITSWEBER Play
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight">
          Hilfe &amp; Glossar
        </h1>
        <p className="text-base leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
          Alle wichtigen Begriffe und Features der Plattform auf einen Blick.
          Klick auf einen Begriff, um mehr zu erfahren.
        </p>
      </header>

      {/* Jump links */}
      <nav aria-label="Abschnitte" className="flex flex-wrap gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.title}
            href={`#${s.ids[0]}`}
            className="rounded-full border px-3 py-1 text-xs font-medium transition hover:border-brand hover:text-brand"
            style={{ borderColor: "var(--color-border)", color: "var(--color-text-secondary)" }}
          >
            {s.title}
          </a>
        ))}
      </nav>

      {SECTIONS.map((section) => (
        <section key={section.title} className="space-y-4">
          <h2 className="text-lg font-bold border-b pb-2" style={{ borderColor: "var(--color-border)" }}>
            {section.title}
          </h2>
          <dl className="space-y-6">
            {section.ids.map((id) => {
              const entry = entryMap.get(id);
              if (!entry) return null;
              return (
                <div key={entry.id} id={entry.id} className="scroll-mt-20">
                  <dt className="text-base font-semibold mb-1" style={{ color: "var(--color-text-primary)" }}>
                    {entry.term}
                  </dt>
                  <dd className="text-sm leading-relaxed" style={{ color: "var(--color-text-secondary)" }}>
                    {entry.definition}
                    {entry.links && entry.links.length > 0 && (
                      <span className="mt-1.5 flex flex-wrap gap-3">
                        {entry.links.map((l) => (
                          <Link
                            key={l.href}
                            href={l.href}
                            className="text-xs font-medium underline underline-offset-2"
                            style={{ color: "var(--color-brand)" }}
                          >
                            {l.label} →
                          </Link>
                        ))}
                      </span>
                    )}
                  </dd>
                </div>
              );
            })}
          </dl>
        </section>
      ))}

      {/* Footer note */}
      <p className="text-xs pb-6" style={{ color: "var(--color-text-muted)" }}>
        Fehlt ein Begriff?{" "}
        <a
          href="mailto:hallo@itsweber.net"
          className="underline"
          style={{ color: "var(--color-brand)" }}
        >
          Schreib uns.
        </a>
      </p>
    </main>
  );
}
