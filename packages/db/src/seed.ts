// Dev-Seed. Bewusst KEIN Admin-Seed — die Admin-Erstanlage passiert über den
// Better-Auth-Register-Flow. Wenn die erste registrierte E-Mail
// $INITIAL_ADMIN_EMAIL entspricht, elevated ein databaseHook den Account auf
// Role.ADMIN und legt einen Default-Channel an (siehe apps/api/src/auth.ts).
//
// Demo-Content (3 Kanäle, 8 Videos, Community-Daten) wird unter
// SEED_DEMO=1 zusätzlich aufgespielt. Voraussetzung: mindestens ein
// ADMIN-User existiert bereits (Register-Flow durchlaufen). Andernfalls
// loggt der Seed eine Warnung und überspringt den Demo-Block.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const STATIC_PAGES = [
  {
    slug: "impressum",
    title: "Impressum",
    order: 0,
    body: `<h1>Impressum</h1>
<p><strong>Angaben gemäß § 5 TMG:</strong></p>
<p>
  [Vorname Nachname]<br>
  [Straße Hausnummer]<br>
  [PLZ] [Stadt]<br>
  Deutschland
</p>
<h2>Kontakt</h2>
<p>
  E-Mail: <a href="mailto:[email@example.com]">[email@example.com]</a>
</p>
<h2>Verantwortlich für den Inhalt nach § 55 Abs. 2 RStV</h2>
<p>
  [Vorname Nachname]<br>
  [Anschrift wie oben]
</p>
<p><em>Bitte ersetze alle [Platzhalter] im Admin-Panel unter /admin/pages.</em></p>`,
  },
  {
    slug: "datenschutz",
    title: "Datenschutzerklärung",
    order: 1,
    body: `<h1>Datenschutzerklärung</h1>
<h2>1. Verantwortlicher</h2>
<p>
  Verantwortlicher im Sinne der DSGVO ist:<br>
  [Vorname Nachname], [Anschrift], [E-Mail]
</p>
<h2>2. Erhobene Daten &amp; Zweck (Art. 13/14 DSGVO)</h2>
<p>
  Bei der Nutzung dieser Plattform werden folgende personenbezogene Daten verarbeitet:
</p>
<ul>
  <li><strong>Registrierung:</strong> E-Mail-Adresse, Anzeigename, Handle — zur Bereitstellung des Nutzerkontos (Art. 6 Abs. 1 lit. b DSGVO).</li>
  <li><strong>Session-Cookie:</strong> Technisch notwendig für die Anmeldung (Art. 6 Abs. 1 lit. f DSGVO).</li>
  <li><strong>Upload-Daten:</strong> Hochgeladene Videos werden auf dem eigenen Server gespeichert und transcodiert.</li>
  <li><strong>Logdaten:</strong> IP-Adresse, Zeitstempel — zur Fehlerbehebung, max. 7 Tage gespeichert.</li>
</ul>
<h2>3. Speicherdauer</h2>
<p>Personenbezogene Daten werden gelöscht, sobald der Zweck der Verarbeitung entfallen ist und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.</p>
<h2>4. Deine Rechte (Art. 15–22 DSGVO)</h2>
<p>Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch. Wende dich dafür an die o. g. Kontaktadresse.</p>
<h2>5. Beschwerderecht</h2>
<p>Du hast das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.</p>
<p><em>Bitte ersetze alle [Platzhalter] im Admin-Panel unter /admin/pages.</em></p>`,
  },
  {
    slug: "agb",
    title: "Allgemeine Geschäftsbedingungen",
    order: 2,
    body: `<h1>Allgemeine Geschäftsbedingungen</h1>
<h2>§ 1 Geltungsbereich</h2>
<p>Diese AGB gelten für die Nutzung der Videoplattform ITSWEBER Play (nachfolgend „Plattform"), betrieben von [Betreiber, Anschrift].</p>
<h2>§ 2 Nutzungsrechte</h2>
<p>Mit dem Hochladen von Inhalten räumt der Creator der Plattform ein nicht-exklusives, weltweites Recht ein, die Inhalte auf der Plattform zu speichern, zu transkodieren und zu streamen. Der Creator bleibt Inhaber der Rechte an seinen Inhalten.</p>
<h2>§ 3 Verbotene Inhalte</h2>
<p>Es ist verboten, Inhalte hochzuladen, die:</p>
<ul>
  <li>gegen geltendes Recht verstoßen,</li>
  <li>Urheberrechte Dritter verletzen,</li>
  <li>pornografische, gewaltverherrlichende oder volksverhetzende Inhalte enthalten.</li>
</ul>
<h2>§ 4 Haftungsausschluss</h2>
<p>Die Plattform haftet nicht für Inhalte, die von Nutzern hochgeladen werden. Meldungen über rechtswidrige Inhalte können über den Report-Button eingereicht werden.</p>
<h2>§ 5 Kündigung</h2>
<p>Nutzer können ihr Konto jederzeit löschen. Der Betreiber behält sich vor, Konten bei Verstößen gegen diese AGB zu sperren oder zu löschen.</p>
<p><em>Bitte ersetze alle [Platzhalter] im Admin-Panel unter /admin/pages.</em></p>`,
  },
];

async function main() {
  const userCount = await prisma.user.count();
  console.log(`[seed] DB bereit — ${userCount} User vorhanden.`);

  for (const page of STATIC_PAGES) {
    await prisma.staticPage.upsert({
      where: { slug: page.slug },
      update: {},
      create: page,
    });
    console.log(`[seed] StaticPage '${page.slug}' bereit.`);
  }

  console.log(
    `[seed] Erste Registrierung mit INITIAL_ADMIN_EMAIL wird via Better-Auth-Hook zu ADMIN elevated.`,
  );

  if (process.env.SEED_DEMO === "1") {
    console.log("[seed] SEED_DEMO=1 — Demo-Content wird erstellt.");
    await ensureDemoContent();
  }
}

// ─── Demo-Content ─────────────────────────────────────────────────────────

const DEMO_CATEGORIES = [
  { slug: "smart-home", name: "Smart Home", icon: "🏠", order: 0 },
  { slug: "3d-druck", name: "3D-Druck", icon: "🧱", order: 1 },
  { slug: "server-it", name: "Server & IT", icon: "🖥️", order: 2 },
  { slug: "docker", name: "Docker", icon: "🐳", order: 3 },
  { slug: "unraid", name: "Unraid", icon: "💾", order: 4 },
  { slug: "tutorials", name: "Tutorials", icon: "🎓", order: 5 },
  { slug: "news", name: "News", icon: "📰", order: 6 },
  { slug: "projekte", name: "Projekte", icon: "🛠️", order: 7 },
];

const DEMO_CHANNELS = [
  {
    slug: "itsweber",
    handle: "admin", // Admin-Channel — owner = INITIAL_ADMIN
    isAdminChannel: true,
    displayName: "ITSWEBER",
    accentColor: "#0fd3c2",
    about:
      "Server, Smart Home und alles dazwischen. Hier dokumentiere ich meine Homelab-Experimente von Unraid bis Zigbee. Tutorials sind immer zum Nachbauen ausgelegt — kein Klick-Bait, sondern echte Setups, die ich selbst betreibe.",
    socialLinks: [
      { platform: "github", url: "https://github.com/itsweber" },
      { platform: "mastodon", url: "https://mastodon.social/@itsweber" },
      { platform: "website", url: "https://itsweber.net" },
    ],
  },
  {
    slug: "tech-tales",
    handle: "tech-tales-host",
    email: "creator1@demo.local",
    displayName: "Tech Tales",
    accentColor: "#a855f7",
    about:
      "Geschichten aus 12 Jahren Software-Entwicklung. Wöchentlich ein neues Deep-Dive-Video zu Datenbanken, verteilten Systemen oder warum manche Tech-Entscheidungen sich erst nach Jahren rächen. Kein Hype, viele Lernkurven.",
    socialLinks: [
      { platform: "twitter", url: "https://twitter.com/techtales" },
      { platform: "youtube", url: "https://youtube.com/@techtales" },
    ],
  },
  {
    slug: "wild-shorts",
    handle: "wild-shorts",
    email: "creator2@demo.local",
    displayName: "Wild Shorts",
    accentColor: "#f59e0b",
    about:
      "Hands-on Maker-Content im 60-Sekunden-Format. Smart-Home-Hacks, LED-Projekte und Tastatur-Tipps, die du sofort selbst ausprobieren kannst. Ich poste nur Sachen, die wirklich funktionieren.",
    socialLinks: [
      { platform: "instagram", url: "https://instagram.com/wildshorts" },
      { platform: "tiktok", url: "https://tiktok.com/@wildshorts" },
    ],
  },
];

interface DemoVideoSpec {
  channelSlug: string;
  slug: string;
  title: string;
  description: string;
  format: "LONG" | "SHORT";
  visibility: "PUBLIC" | "UNLISTED" | "PRIVATE";
  durationSec: number;
  tags: string[];
  categorySlug: string | null;
  viewCount: number;
  // Optional: rawKey im play-raw-Bucket (gesetzt durch seed-demo-videos.sh).
  // Wenn gesetzt → Video kann transkodiert werden. Wenn nicht → status FAILED
  // mit Hinweis auf docs/23-demo-assets.md.
  rawKey?: string;
}

const DEMO_VIDEOS: DemoVideoSpec[] = [
  // 3 PUBLIC LIVE LONG
  {
    channelSlug: "itsweber",
    slug: "demo-itsweber-server-tour",
    title: "Mein Server-Setup 2026 — komplette Tour",
    description:
      "Vom Unraid-Host bis zum letzten Docker-Container: Was läuft eigentlich in meinem Rack? In diesem Video zeige ich die komplette Hardware, das Netzwerk und alle Services. Ideal als Inspiration für deinen eigenen Homelab-Aufbau.",
    format: "LONG",
    visibility: "PUBLIC",
    durationSec: 624,
    tags: ["server", "homelab", "unraid", "docker"],
    categorySlug: "server-it",
    viewCount: 1284,
  },
  {
    channelSlug: "tech-tales",
    slug: "demo-tech-tales-docker-networking",
    title: "Docker-Networking ohne Tränen",
    description:
      "Bridge, Host, Macvlan — wann nutze ich welches Network-Driver? Dieses Video räumt mit den häufigsten Missverständnissen auf und zeigt für jedes Szenario das passende Setup.",
    format: "LONG",
    visibility: "PUBLIC",
    durationSec: 412,
    tags: ["docker", "networking", "tutorial"],
    categorySlug: "docker",
    viewCount: 873,
  },
  {
    channelSlug: "tech-tales",
    slug: "demo-tech-tales-postgres-love",
    title: "Warum ich Postgres liebe — nach 12 Jahren MySQL",
    description:
      "Ein ehrlicher Erfahrungsbericht über den Umstieg von MySQL auf Postgres in einer Production-Umgebung. Was war einfacher, was war hart, und welche Features haben mich überzeugt?",
    format: "LONG",
    visibility: "PUBLIC",
    durationSec: 728,
    tags: ["postgres", "mysql", "datenbank", "migration"],
    categorySlug: "tutorials",
    viewCount: 502,
  },
  // 3 PUBLIC LIVE SHORT
  {
    channelSlug: "wild-shorts",
    slug: "demo-wild-shorts-smart-home-hack",
    title: "60 Sekunden Smart-Home-Hack",
    description:
      "Mit einem Zigbee-Button und drei Zeilen YAML steuerst du dein ganzes Wohnzimmer. So geht's.",
    format: "SHORT",
    visibility: "PUBLIC",
    durationSec: 58,
    tags: ["smarthome", "zigbee", "hack"],
    categorySlug: "smart-home",
    viewCount: 4321,
  },
  {
    channelSlug: "wild-shorts",
    slug: "demo-wild-shorts-keyboard-shortcut",
    title: "Tastatur-Shortcut, den keiner kennt",
    description:
      "Strg+Shift+T bringt deinen letzten geschlossenen Browser-Tab zurück. Du wirst es lieben.",
    format: "SHORT",
    visibility: "PUBLIC",
    durationSec: 22,
    tags: ["productivity", "shortcut", "browser"],
    categorySlug: "tutorials",
    viewCount: 2891,
  },
  {
    channelSlug: "wild-shorts",
    slug: "demo-wild-shorts-led-strip",
    title: "LED-Strip in 30 s installiert",
    description:
      "Schnelles Tutorial: WLED auf einem ESP32 flashen, LED-Strip anschließen, Home Assistant einbinden. Fertig.",
    format: "SHORT",
    visibility: "PUBLIC",
    durationSec: 34,
    tags: ["wled", "esp32", "led", "diy"],
    categorySlug: "projekte",
    viewCount: 1678,
  },
  // 1 UNLISTED LONG
  {
    channelSlug: "itsweber",
    slug: "demo-itsweber-unraid-quickstart",
    title: "Unraid in 10 Minuten erklärt (Beta-Preview)",
    description:
      "Geheime Vorschau auf den nächsten großen Tutorial-Drop. Nur über den direkten Link erreichbar.",
    format: "LONG",
    visibility: "UNLISTED",
    durationSec: 612,
    tags: ["unraid", "tutorial", "preview"],
    categorySlug: "unraid",
    viewCount: 47,
  },
  // 1 PRIVATE LONG
  {
    channelSlug: "tech-tales",
    slug: "demo-tech-tales-roadmap-2026",
    title: "Roadmap 2026 — interner Plan",
    description:
      "Persönliche Notizen für die nächsten 12 Monate. Nicht öffentlich.",
    format: "LONG",
    visibility: "PRIVATE",
    durationSec: 318,
    tags: ["roadmap", "intern"],
    categorySlug: null,
    viewCount: 0,
  },

  // ── 4 Remotion-Demo-Videos (echte HLS-Assets via seed-demo-videos.sh) ───────
  // rawKey wird durch scripts/seed-demo-videos.sh befüllt.
  // Ohne rawKey → status FAILED + Hinweis für den Operator.
  {
    channelSlug: "itsweber",
    slug: "demo-itsweber-play-welcome",
    title: "Willkommen bei ITSWEBER Play",
    description:
      "Was ist ITSWEBER Play? In 90 Sekunden zeigen wir dir die wichtigsten Features: selbst gehostet, Multi-Creator, anpassbares Theming, Shorts und Videos — alles auf einer Privacy-First-Plattform.",
    format: "LONG",
    visibility: "PUBLIC",
    durationSec: 90,
    tags: ["intro", "willkommen", "plattform", "demo"],
    categorySlug: "tutorials",
    viewCount: 0,
    rawKey: "demo-assets/WelcomeLong.mp4",
  },
  {
    channelSlug: "itsweber",
    slug: "demo-itsweber-studio-tour",
    title: "Das Studio in 60 Sekunden",
    description:
      "Eine schnelle Tour durch das Creator-Studio: Video hochladen, schneiden, Captions hinzufügen, Analytics auswerten, Channel-Branding anpassen — alles in unter einer Minute.",
    format: "LONG",
    visibility: "PUBLIC",
    durationSec: 60,
    tags: ["studio", "tutorial", "creator", "demo"],
    categorySlug: "tutorials",
    viewCount: 0,
    rawKey: "demo-assets/StudioTourLong.mp4",
  },
  {
    channelSlug: "itsweber",
    slug: "demo-itsweber-shorts-feature",
    title: "Shorts — kurz, direkt, dein Format",
    description:
      "ITSWEBER Play unterstützt vertikale Shorts nativ: 1080×1920, 60 fps, HLS-Streaming. Kein separater Upload-Flow — einfach Format wählen und hochladen.",
    format: "SHORT",
    visibility: "PUBLIC",
    durationSec: 15,
    tags: ["shorts", "feature", "vertikal", "demo"],
    categorySlug: "tutorials",
    viewCount: 0,
    rawKey: "demo-assets/ShortsFeatureShort.mp4",
  },
  {
    channelSlug: "itsweber",
    slug: "demo-itsweber-barrierefrei",
    title: "Barrierefrei designed",
    description:
      "ITSWEBER Play ist von Grund auf barrierefrei: automatische Captions via Whisper, vollständige Tastatur-Navigation, WCAG 2.2 AA auf allen Key-Pages, Transcript-Panel neben dem Video.",
    format: "SHORT",
    visibility: "PUBLIC",
    durationSec: 20,
    tags: ["a11y", "accessibility", "captions", "demo"],
    categorySlug: "tutorials",
    viewCount: 0,
    rawKey: "demo-assets/AccessibilityShort.mp4",
  },
];

const DEMO_COMMENTS: Array<{
  videoSlug: string;
  authorHandle: string;
  body: string;
  replies?: Array<{ authorHandle: string; body: string }>;
}> = [
  {
    videoSlug: "demo-itsweber-server-tour",
    authorHandle: "tech-tales-host",
    body: "Geile Tour! Welcher Switch ist das im zweiten Rack?",
    replies: [
      {
        authorHandle: "admin",
        body: "Das ist ein MikroTik CRS328 — läuft seit zwei Jahren ohne Murren.",
      },
    ],
  },
  {
    videoSlug: "demo-tech-tales-docker-networking",
    authorHandle: "admin",
    body: "Endlich mal jemand, der Macvlan vernünftig erklärt.",
    replies: [
      {
        authorHandle: "tech-tales-host",
        body: "Danke! Hat ewig gedauert, das selbst zu kapieren.",
      },
    ],
  },
  {
    videoSlug: "demo-wild-shorts-smart-home-hack",
    authorHandle: "admin",
    body: "Sehr nice — werde ich heute Abend nachbauen.",
  },
  {
    videoSlug: "demo-tech-tales-postgres-love",
    authorHandle: "wild-shorts",
    body: "Gibt's auch ein Video zum Reverse-Path: Postgres → SQLite für Embedded?",
    replies: [
      {
        authorHandle: "tech-tales-host",
        body: "Steht auf der Liste für Q3 2026!",
      },
      {
        authorHandle: "admin",
        body: "+1, das wäre interessant.",
      },
    ],
  },
  {
    videoSlug: "demo-wild-shorts-led-strip",
    authorHandle: "tech-tales-host",
    body: "WLED ist Gold wert. Fork davon läuft bei mir auf 12 ESPs.",
  },
];

async function ensureDemoContent() {
  // ─── Categories sicherstellen ──────────────────────────────────────
  for (const cat of DEMO_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`[seed:demo] ${DEMO_CATEGORIES.length} Categories bereit.`);

  // ─── SiteSettings-Singleton ────────────────────────────────────────
  await prisma.siteSettings.upsert({
    where: { id: "singleton" },
    update: {},
    create: {
      id: "singleton",
      siteName: "ITSWEBER Play",
      siteTagline: "Die Plattform für eigene Stimmen.",
      contactEmail: "hallo@itsweber.net",
      registrationMode: "OPEN",
      defaultVisibility: "PRIVATE",
      defaultCommentsEnabled: true,
    },
  });
  console.log("[seed:demo] SiteSettings bereit.");

  // ─── Admin-User finden (Voraussetzung) ─────────────────────────────
  const adminUser = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
  });
  if (!adminUser) {
    console.warn(
      "[seed:demo] Kein ADMIN-User gefunden. Bitte zuerst über die /register-Seite mit INITIAL_ADMIN_EMAIL registrieren. Demo-Seed wird übersprungen.",
    );
    return;
  }
  console.log(`[seed:demo] Admin-User: ${adminUser.handle} (${adminUser.email})`);

  // ─── Demo-Creator (User ohne Account-Row → kein Login möglich) ─────
  const userByHandle = new Map<string, string>();
  userByHandle.set(adminUser.handle, adminUser.id);

  for (const ch of DEMO_CHANNELS) {
    if (ch.isAdminChannel) continue;
    const user = await prisma.user.upsert({
      where: { email: ch.email! },
      update: {},
      create: {
        email: ch.email!,
        emailVerified: true,
        displayName: ch.displayName,
        handle: ch.handle,
        role: "CREATOR",
      },
    });
    userByHandle.set(ch.handle, user.id);
  }
  console.log(`[seed:demo] ${userByHandle.size} User-Lookups bereit.`);

  // ─── Channels (3) ──────────────────────────────────────────────────
  const channelBySlug = new Map<string, string>();
  for (const ch of DEMO_CHANNELS) {
    const ownerId = ch.isAdminChannel
      ? adminUser.id
      : userByHandle.get(ch.handle);
    if (!ownerId) {
      console.warn(`[seed:demo] Owner für ${ch.slug} nicht gefunden — skip.`);
      continue;
    }
    const channel = await prisma.channel.upsert({
      where: { slug: ch.slug },
      update: {
        displayName: ch.displayName,
        accentColor: ch.accentColor,
        about: ch.about,
        socialLinks: ch.socialLinks,
        sectionOrder: [
          "featured",
          "latest",
          "shorts",
          "popular",
          "playlists",
          "about",
        ],
      },
      create: {
        slug: ch.slug,
        ownerId,
        displayName: ch.displayName,
        accentColor: ch.accentColor,
        about: ch.about,
        socialLinks: ch.socialLinks,
        sectionOrder: [
          "featured",
          "latest",
          "shorts",
          "popular",
          "playlists",
          "about",
        ],
      },
    });
    channelBySlug.set(ch.slug, channel.id);
  }
  console.log(`[seed:demo] ${channelBySlug.size} Channels bereit.`);

  // ─── Videos (8) ────────────────────────────────────────────────────
  const videoBySlug = new Map<string, string>();
  const videoChannelIdBySlug = new Map<string, string>();
  for (const v of DEMO_VIDEOS) {
    const channelId = channelBySlug.get(v.channelSlug);
    if (!channelId) {
      console.warn(`[seed:demo] Channel ${v.channelSlug} fehlt — skip ${v.slug}`);
      continue;
    }
    const channel = DEMO_CHANNELS.find((c) => c.slug === v.channelSlug)!;
    const ownerId = channel.isAdminChannel
      ? adminUser.id
      : userByHandle.get(channel.handle);
    if (!ownerId) continue;

    const categoryId = v.categorySlug
      ? (await prisma.category.findUnique({
          where: { slug: v.categorySlug },
          select: { id: true },
        }))?.id ?? null
      : null;

    // Remotion-Videos: status LIVE nur wenn rawKey im Bucket existiert.
    // Der seed-demo-videos.sh-Script setzt die MinIO-Objekte und triggert
    // den Transcode. Bis dahin bleibt status FAILED mit klarem Hinweis.
    const isRemotionVideo = Boolean(v.rawKey);
    const videoStatus = isRemotionVideo ? "FAILED" : "LIVE";
    const failureReason = isRemotionVideo
      ? "Demo-Assets nicht geladen — bitte scripts/seed-demo-videos.sh ausführen. Siehe docs/23-demo-assets.md."
      : null;

    const video = await prisma.video.upsert({
      where: { slug: v.slug },
      update: {
        title: v.title,
        description: v.description,
        format: v.format,
        visibility: v.visibility,
        durationSec: v.durationSec,
        tags: v.tags,
        categoryId,
        viewCount: v.viewCount,
      },
      create: {
        slug: v.slug,
        ownerId,
        channelId,
        title: v.title,
        description: v.description,
        format: v.format,
        visibility: v.visibility,
        status: videoStatus,
        source: "UPLOAD",
        durationSec: v.durationSec,
        tags: v.tags,
        categoryId,
        viewCount: v.viewCount,
        publishedAt: isRemotionVideo ? null : new Date(),
        failureReason,
      },
    });
    videoBySlug.set(v.slug, video.id);
    videoChannelIdBySlug.set(v.slug, channelId);
  }
  console.log(`[seed:demo] ${videoBySlug.size} Videos bereit.`);

  // ─── Subscriptions (admin + creator1 → alle 3 Kanäle) ──────────────
  const subscribers = [adminUser.id, userByHandle.get("tech-tales-host")!].filter(
    Boolean,
  );
  let subCount = 0;
  for (const subId of subscribers) {
    for (const [slug, channelId] of channelBySlug.entries()) {
      const channel = DEMO_CHANNELS.find((c) => c.slug === slug)!;
      const ownerId = channel.isAdminChannel
        ? adminUser.id
        : userByHandle.get(channel.handle);
      if (subId === ownerId) continue; // Self-Subscribe skip
      await prisma.subscription.upsert({
        where: {
          subscriberId_channelId: { subscriberId: subId, channelId },
        },
        update: {},
        create: { subscriberId: subId, channelId, notify: true },
      });
      subCount++;
    }
  }
  console.log(`[seed:demo] ${subCount} Subscriptions bereit.`);

  // ─── Kommentare + Replies ──────────────────────────────────────────
  let commentCount = 0;
  for (const c of DEMO_COMMENTS) {
    const videoId = videoBySlug.get(c.videoSlug);
    const userId = userByHandle.get(c.authorHandle);
    if (!videoId || !userId) continue;

    const existing = await prisma.comment.findFirst({
      where: { videoId, userId, body: c.body, parentId: null },
      select: { id: true },
    });
    const parent =
      existing ??
      (await prisma.comment.create({
        data: { videoId, userId, body: c.body },
        select: { id: true },
      }));
    if (!existing) commentCount++;

    for (const reply of c.replies ?? []) {
      const replyUserId = userByHandle.get(reply.authorHandle);
      if (!replyUserId) continue;
      const existingReply = await prisma.comment.findFirst({
        where: {
          videoId,
          userId: replyUserId,
          body: reply.body,
          parentId: parent.id,
        },
        select: { id: true },
      });
      if (!existingReply) {
        await prisma.comment.create({
          data: {
            videoId,
            userId: replyUserId,
            body: reply.body,
            parentId: parent.id,
          },
        });
        commentCount++;
      }
    }
  }
  console.log(`[seed:demo] ${commentCount} neue Kommentare/Replies erstellt.`);

  // ─── Reactions (Likes) — 10 Stück über User × LIVE-PUBLIC-Videos ──
  const liveVideoSlugs = DEMO_VIDEOS.filter(
    (v) => v.visibility === "PUBLIC",
  ).map((v) => v.slug);
  const allUserIds = [
    adminUser.id,
    userByHandle.get("tech-tales-host")!,
    userByHandle.get("wild-shorts")!,
  ].filter(Boolean);

  let reactionCount = 0;
  for (let i = 0; i < 10; i++) {
    const userId = allUserIds[i % allUserIds.length]!;
    const slug = liveVideoSlugs[i % liveVideoSlugs.length]!;
    const videoId = videoBySlug.get(slug);
    if (!videoId) continue;
    await prisma.reaction.upsert({
      where: { userId_videoId: { userId, videoId } },
      update: {},
      create: { userId, videoId },
    });
    reactionCount++;
  }
  console.log(`[seed:demo] ${reactionCount} Reactions bereit.`);

  // ─── Watch-History (admin schaut 3 LIVE-Videos) ────────────────────
  const adminHistory = liveVideoSlugs.slice(0, 3);
  for (const slug of adminHistory) {
    const videoId = videoBySlug.get(slug);
    if (!videoId) continue;
    await prisma.watchHistory.upsert({
      where: { userId_videoId: { userId: adminUser.id, videoId } },
      update: { watchedAt: new Date() },
      create: { userId: adminUser.id, videoId },
    });
  }
  console.log(`[seed:demo] ${adminHistory.length} Watch-History-Einträge bereit.`);

  // ─── Playlists (1 pro Kanal mit 2-3 Videos) ────────────────────────
  for (const ch of DEMO_CHANNELS) {
    const channelId = channelBySlug.get(ch.slug);
    if (!channelId) continue;
    const ownerId = ch.isAdminChannel
      ? adminUser.id
      : userByHandle.get(ch.handle);
    if (!ownerId) continue;

    // PUBLIC-LIVE-Videos vom Kanal sammeln (max 3)
    const channelVideoSlugs = DEMO_VIDEOS.filter(
      (v) => v.channelSlug === ch.slug && v.visibility === "PUBLIC",
    )
      .slice(0, 3)
      .map((v) => v.slug);

    if (channelVideoSlugs.length < 2) continue;

    const playlist = await prisma.playlist.upsert({
      where: { slug: `best-of-${ch.slug}` },
      update: { title: `Best of ${ch.displayName}` },
      create: {
        slug: `best-of-${ch.slug}`,
        ownerId,
        channelId,
        title: `Best of ${ch.displayName}`,
        description: `Die meistgesehenen Videos von ${ch.displayName}.`,
        visibility: "PUBLIC",
      },
    });

    for (const [position, videoSlug] of channelVideoSlugs.entries()) {
      const videoId = videoBySlug.get(videoSlug);
      if (!videoId) continue;
      await prisma.playlistItem.upsert({
        where: {
          playlistId_videoId: { playlistId: playlist.id, videoId },
        },
        update: { position },
        create: { playlistId: playlist.id, videoId, position },
      });
    }
  }
  console.log(`[seed:demo] Playlists pro Kanal bereit.`);

  console.log("[seed:demo] ✓ Demo-Content vollständig.");
}

main()
  .catch((err) => {
    console.error("[seed] fehlgeschlagen:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
