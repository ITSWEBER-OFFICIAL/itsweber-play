// Server-only helper — fetches a StaticPage via the API tRPC GET endpoint.
// Used by /impressum, /datenschutz, /agb, etc. Returns null when the page
// doesn't exist or the API is unreachable (caller handles notFound()).

const API_URL = process.env.API_URL ?? "http://localhost:4000";

export interface StaticPageData {
  slug: string;
  title: string;
  body: string;
  published: boolean;
  updatedAt: string;
}

export async function fetchStaticPage(
  slug: string,
): Promise<StaticPageData | null> {
  try {
    const url = `${API_URL}/api/trpc/staticPage.getBySlug?input=${encodeURIComponent(
      JSON.stringify({ slug }),
    )}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: { data?: StaticPageData };
    };
    return body.result?.data ?? null;
  } catch {
    return null;
  }
}
