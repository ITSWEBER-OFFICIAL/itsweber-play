"use client";

import Link from "next/link";
import { useSession } from "@/lib/auth-client";
import { trpc } from "@/lib/trpc";
import { toast } from "@/lib/toast";

// Abonniert / entfolgt einen Kanal. Wenn der Viewer nicht eingeloggt ist,
// zeigt der Button stattdessen einen Login-CTA; eingeloggte Eigentümer
// sehen den Button ausgeblendet (eigenen Kanal abonnieren ergibt keinen Sinn).

export function SubscribeButton({
  channelId,
  channelOwnerId,
  size = "md",
  accentColor,
}: {
  channelId: string;
  channelOwnerId: string;
  size?: "sm" | "md";
  accentColor?: string;
}) {
  const { data: session } = useSession();
  const user = session?.user as { id?: string } | undefined;
  const isOwn = user?.id === channelOwnerId;

  const status = trpc.subscription.isSubscribed.useQuery(
    { channelId },
    { enabled: !!user && !isOwn },
  );
  const utils = trpc.useUtils();
  const toggle = trpc.subscription.toggle.useMutation({
    onSuccess: (res) => {
      utils.subscription.isSubscribed.invalidate({ channelId });
      utils.subscription.list.invalidate();
      utils.subscription.latestVideos.invalidate();
      toast.success(res.subscribed ? "Abonniert" : "Abo entfernt");
    },
    onError: (err) => toast.error(err.message),
  });

  if (isOwn) {
    return (
      <span className="mono rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] uppercase tracking-wider text-dim">
        Dein Kanal
      </span>
    );
  }

  if (!user) {
    return (
      <Link
        href="/login"
        className={
          "inline-flex items-center gap-2 rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-muted transition hover:bg-surface-raised " +
          (size === "sm" ? "py-1.5 text-xs" : "py-2")
        }
      >
        Anmelden zum Abonnieren
      </Link>
    );
  }

  const subscribed = status.data?.subscribed === true;

  const accentStyle =
    !subscribed && accentColor
      ? ({ background: accentColor, boxShadow: `0 0 0 3px ${accentColor}44` } as React.CSSProperties)
      : undefined;

  return (
    // eslint-disable-next-line react/forbid-dom-props
    <button
      type="button"
      disabled={status.isPending || toggle.isPending}
      onClick={() => toggle.mutate({ channelId })}
      style={accentStyle}
      className={
        "inline-flex items-center gap-2 rounded-md text-sm font-medium transition disabled:opacity-60 " +
        (subscribed
          ? "border border-border-strong bg-surface text-muted hover:border-danger hover:text-danger"
          : accentColor
            ? "text-neutral-900"
            : "bg-brand text-neutral-900 hover:bg-brand-hover [box-shadow:var(--shadow-glow)]") +
        " " +
        (size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2")
      }
    >
      {subscribed ? (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Abonniert
        </>
      ) : (
        <>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-4H7v-2h4V7h2v4h4v2h-4v4z" />
          </svg>
          Abonnieren
        </>
      )}
    </button>
  );
}
