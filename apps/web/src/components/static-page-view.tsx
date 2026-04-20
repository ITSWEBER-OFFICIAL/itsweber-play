// Renders a StaticPage from the DB. body is trusted HTML — only admins can
// edit it. No DOMPurify needed server-side; the admin is the content owner.
// Tailwind prose classes give the legal text readable typography.

import type { StaticPageData } from "@/lib/static-page-ssr";

interface Props {
  page: StaticPageData;
}

export function StaticPageView({ page }: Props) {
  const updatedDate = new Intl.DateTimeFormat("de-DE", {
    dateStyle: "long",
  }).format(new Date(page.updatedAt));

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10">
        <h1 className="text-[32px] font-extrabold tracking-tight">
          {page.title}
        </h1>
        <p className="mt-2 text-sm text-muted">
          Zuletzt aktualisiert: {updatedDate}
        </p>
      </header>

      {/* Legal HTML from Admin CMS — admin-only editable, trusted source. */}
      <div
        className="prose-legal"
        dangerouslySetInnerHTML={{ __html: page.body }}
      />
    </div>
  );
}
