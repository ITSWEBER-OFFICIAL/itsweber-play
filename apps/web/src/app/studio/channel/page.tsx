"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { StudioGate } from "@/components/studio-gate";
import { toast } from "@/lib/toast";

type Platform =
  | "website"
  | "youtube"
  | "twitter"
  | "github"
  | "mastodon"
  | "instagram"
  | "linkedin"
  | "email"
  | "other";

interface SocialLink {
  platform: Platform;
  url: string;
}

interface ChannelForEdit {
  id: string;
  slug: string;
  displayName: string;
  description: string | null;
  about: string | null;
  socialLinks: unknown;
  avatarUrl: string | null;
  bannerUrl: string | null;
  createdAt: string | Date;
  _count: { videos: number };
}

const PLATFORMS: { id: Platform; label: string }[] = [
  { id: "website", label: "Website" },
  { id: "youtube", label: "YouTube" },
  { id: "twitter", label: "Twitter / X" },
  { id: "github", label: "GitHub" },
  { id: "mastodon", label: "Mastodon" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "email", label: "E-Mail" },
  { id: "other", label: "Sonstiges" },
];

export default function StudioChannelPage() {
  return (
    <StudioGate>
      <ChannelEditor />
    </StudioGate>
  );
}

function ChannelEditor() {
  const channel = trpc.channel.myChannel.useQuery();
  const utils = trpc.useUtils();

  const [displayName, setDisplayName] = useState("");
  const [description, setDescription] = useState("");
  const [about, setAbout] = useState("");
  const [links, setLinks] = useState<SocialLink[]>([]);

  useEffect(() => {
    if (!channel.data) return;
    const c = channel.data as unknown as ChannelForEdit;
    setDisplayName(c.displayName);
    setDescription(c.description ?? "");
    setAbout(c.about ?? "");
    const raw = (c.socialLinks as SocialLink[] | null) ?? [];
    setLinks(
      raw.filter(
        (l) => l && typeof l.platform === "string" && typeof l.url === "string",
      ),
    );
  }, [channel.data?.id]);

  const update = trpc.channel.updateProfile.useMutation({
    onSuccess: () => {
      utils.channel.myChannel.invalidate();
      toast.success("Kanal-Profil gespeichert");
    },
    onError: (err) => toast.error(err.message),
  });

  function save() {
    if (!channel.data) return;
    const cleanLinks = links.filter(
      (l) => l.url.trim().length > 0 && isValidUrl(l.url),
    );
    update.mutate({
      id: channel.data.id,
      displayName: displayName.trim(),
      description: description.trim() || null,
      about: about.trim() || null,
      socialLinks: cleanLinks,
    });
  }

  if (channel.isPending) return <p className="text-muted">Lädt …</p>;
  if (channel.error)
    return <p className="text-danger">{channel.error.message}</p>;
  const c = channel.data as unknown as ChannelForEdit;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">
            Kanal-Profil
          </h1>
          <p className="mt-1 text-sm text-muted">
            So sehen dich andere auf deinem{" "}
            <Link
              href={`/c/${c.slug}`}
              target="_blank"
              className="text-brand hover:underline"
            >
              Channel
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={update.isPending}
          className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-medium text-neutral-900 transition hover:bg-brand-hover disabled:opacity-60 [box-shadow:var(--shadow-glow)]"
        >
          {update.isPending ? "Speichert …" : "Speichern"}
        </button>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card title="Basis">
            <Field label="Anzeigename">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={80}
                className="w-full rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
              />
            </Field>
            <Field label="Kurzbeschreibung (max. 500 Zeichen)">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
                placeholder="Zeile, die unter deinem Kanal-Namen steht."
              />
              <div className="mono mt-1 text-[10px] text-dim">
                {description.length}/500
              </div>
            </Field>
            <Field label="Über den Kanal (Markdown erlaubt, später)">
              <textarea
                value={about}
                onChange={(e) => setAbout(e.target.value)}
                maxLength={5000}
                rows={8}
                className="mono w-full resize-y rounded-md border border-border bg-surface-raised px-3 py-2 text-xs text-foreground outline-none focus:border-brand"
                placeholder="Was macht den Kanal aus, wer steckt dahinter, Upload-Rhythmus, etc."
              />
            </Field>
          </Card>

          <Card title="Social-Links">
            <p className="mb-3 text-[11px] text-muted">
              Max. 10 Einträge. Werden im Kanal-Header als Icons gerendert.
            </p>
            <ul className="space-y-2">
              {links.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <select
                    aria-label="Plattform"
                    value={l.platform}
                    onChange={(e) => {
                      const next = [...links];
                      next[i] = { ...l, platform: e.target.value as Platform };
                      setLinks(next);
                    }}
                    className="rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-foreground"
                  >
                    {PLATFORMS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="url"
                    value={l.url}
                    onChange={(e) => {
                      const next = [...links];
                      next[i] = { ...l, url: e.target.value };
                      setLinks(next);
                    }}
                    placeholder="https://…"
                    className="mono flex-1 rounded-md border border-border bg-surface-raised px-2 py-1.5 text-xs text-foreground outline-none focus:border-brand"
                  />
                  <button
                    type="button"
                    onClick={() => setLinks(links.filter((_, j) => j !== i))}
                    className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-muted hover:border-danger hover:text-danger"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
            {links.length < 10 && (
              <button
                type="button"
                onClick={() =>
                  setLinks([...links, { platform: "website", url: "" }])
                }
                className="mt-3 rounded-md border border-dashed border-border bg-surface-raised px-3 py-1.5 text-xs text-muted hover:border-border-strong hover:text-foreground"
              >
                + Link hinzufügen
              </button>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Vorschau">
            <div className="rounded-lg border border-border bg-surface-raised p-4">
              <div className="mb-3 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-lg font-bold text-neutral-900">
                {displayName[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="font-semibold text-foreground">
                {displayName || "(Name)"}
              </div>
              <div className="text-xs text-muted">@{c.slug}</div>
              {description && (
                <p className="mt-2 text-xs text-muted">{description}</p>
              )}
              <div className="mono mt-3 text-[10px] text-dim">
                {c._count.videos} Videos · seit{" "}
                {new Date(c.createdAt).toLocaleDateString("de-DE")}
              </div>
            </div>
          </Card>
          <Card title="Branding">
            <p className="text-xs text-muted">
              Avatar- und Banner-Upload kommen mit Session 5 (Branding-Tab).
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      {children}
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mb-3 block last:mb-0">
      <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}

function isValidUrl(u: string): boolean {
  try {
    new URL(u);
    return true;
  } catch {
    return false;
  }
}
