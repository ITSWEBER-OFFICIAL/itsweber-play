// Next.js Middleware (Session M).
//
// Zwei Aufgaben:
//   1) Setup-Wizard-Redirect — solange `setup.status.required = true` ist,
//      werden alle Browser-Routen auf /setup umgelenkt. Sobald das Wizard
//      durchlief, lockt /setup nicht mehr (Redirect zurück nach /).
//   2) Pathname-Header setzen, damit das (server-rendered) RootLayout den
//      SiteHeader/Footer auf /setup ausblenden kann (siehe app/layout.tsx).
//
// Die Status-Antwort wird kurz gecached (30 s), und sobald wir einmal
// `completed=true` gesehen haben, schalten wir den API-Round-Trip ganz aus
// — der Flag dreht sich nie wieder zurück.

import { NextResponse, type NextRequest } from "next/server";

const STATUS_TTL_MS = 30 * 1000;
const SETUP_PATH = "/setup";
const PATHNAME_HEADER = "x-pathname";

// Same logic as apps/web/src/lib/trpc.ts but server-only — Window existiert
// in der Middleware nicht.
const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.API_URL ??
  "http://127.0.0.1:4000";

type SetupStatus = {
  completed: boolean;
  required: boolean;
  bypassWithEnv: boolean;
};

let cached: { value: SetupStatus; until: number } | null = null;
let stickyCompleted = false;

async function fetchSetupStatus(req: NextRequest): Promise<SetupStatus | null> {
  if (stickyCompleted) {
    return { completed: true, required: false, bypassWithEnv: false };
  }
  const now = Date.now();
  if (cached && cached.until > now) return cached.value;

  try {
    const url = `${API_URL}/api/trpc/setup.status`;
    const res = await fetch(url, {
      // Pass through the cookie so der internal-Fetch identisch zum normalen
      // Browser-Call aussieht (Better-Auth liest Session-Cookies).
      headers: { cookie: req.headers.get("cookie") ?? "" },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: { data?: SetupStatus } };
    const data = body.result?.data;
    if (!data) return null;
    cached = { value: data, until: now + STATUS_TTL_MS };
    if (data.completed) stickyCompleted = true;
    return data;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Pathname für RSC-Layouts durchreichen — SiteHeader/Footer skip auf /setup.
  const headers = new Headers(req.headers);
  headers.set(PATHNAME_HEADER, pathname);

  const status = await fetchSetupStatus(req);

  // API noch nicht erreichbar (Boot-Reihenfolge, Healthcheck flatter) —
  // wir blocken NICHT, sondern lassen die normale Seite laden. Wer dann
  // eingeloggt ist, sieht eh keinen Wizard.
  if (!status) {
    return NextResponse.next({ request: { headers } });
  }

  const onSetup = pathname === SETUP_PATH || pathname.startsWith(`${SETUP_PATH}/`);

  if (status.required && !onSetup) {
    const url = req.nextUrl.clone();
    url.pathname = SETUP_PATH;
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (status.completed && onSetup) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next({ request: { headers } });
}

export const config = {
  // Matcher schließt Statisches und API-Routen aus. /api/* gehört Fastify
  // (kommt eh nie hier vorbei, weil NPM/Compose Pfade trennt — aber besser
  // belt-and-suspenders). Next-Internals + Bilder bleiben unangetastet.
  matcher: [
    "/((?!api/|_next/|_vercel|.*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|map|woff2?)$).*)",
  ],
};
