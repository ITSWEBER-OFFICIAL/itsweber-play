"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/lib/auth-client";
import { Icon } from "@/components/icon";

const STORAGE_KEY = "onboarding-done";

const STEPS = [
  {
    target: "#header-create-button",
    title: "Video hochladen",
    body: "Klick auf den + Button oben rechts, um dein erstes Video hochzuladen oder zu importieren. Du kannst zwischen Long-Video und Short wählen.",
    icon: "upload" as const,
  },
  {
    target: "#studio-link",
    title: "Dein Studio",
    body: "Im Studio findest du alle deine Videos: schneiden, Captions hinzufügen, Sichtbarkeit setzen, Thumbnail ändern — alles an einem Ort.",
    icon: "layers" as const,
  },
  {
    target: "#admin-link",
    title: "Admin-Panel",
    body: "Als Admin kannst du Themes, SMTP-Einstellungen, User und Seiten verwalten. Mach die Plattform zu deiner.",
    icon: "wrench" as const,
  },
  {
    target: null,
    title: "Fertig — viel Spaß!",
    body: "Alle Einstellungen findest du auch später unter /admin. Bei Fragen hilft dir /help weiter.",
    icon: "sparkles" as const,
  },
] as const;

export function OnboardingTour() {
  const { data: session } = useSession();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!session?.user) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    // Small delay so the page finishes rendering
    const t = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(t);
  }, [session?.user]);

  if (!visible) return null;

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, "1");
    setVisible(false);
  }

  function next() {
    if (isLast) {
      dismiss();
    } else {
      setStep((s) => s + 1);
    }
  }

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(10, 26, 38, 0.85)", backdropFilter: "blur(4px)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Einführungstour"
    >
      {/* Card */}
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl"
        style={{
          background: "var(--color-surface)",
          border: "1px solid var(--color-border)",
          boxShadow: "0 32px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* Step indicator */}
        <div className="flex gap-1.5 px-6 pt-5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className="h-1 flex-1 rounded-full transition-all"
              style={{
                background:
                  i <= step
                    ? "var(--color-brand)"
                    : "var(--color-border)",
              }}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-6 pt-5">
          <div
            className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
            style={{ background: "color-mix(in srgb, var(--color-brand) 15%, transparent)" }}
          >
            <Icon name={current.icon} size={22} className="text-brand" />
          </div>

          <h2
            className="text-xl font-bold mb-2"
            style={{ color: "var(--color-text-primary)" }}
          >
            {current.title}
          </h2>
          <p
            className="text-sm leading-relaxed mb-6"
            style={{ color: "var(--color-text-secondary)" }}
          >
            {current.body}
          </p>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={dismiss}
              className="text-sm underline underline-offset-2 hover:no-underline"
              style={{ color: "var(--color-text-muted)" }}
            >
              Überspringen
            </button>
            <button
              type="button"
              onClick={next}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
              style={{
                background: "var(--color-brand)",
                color: "var(--color-brand-text, var(--color-neutral-900))",
              }}
            >
              {isLast ? (
                <>
                  <Icon name="check" size={15} />
                  Loslegen
                </>
              ) : (
                <>
                  Weiter
                  <Icon name="chevron-right" size={15} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          type="button"
          onClick={dismiss}
          aria-label="Tour schließen"
          className="absolute top-4 right-4 rounded-lg p-1.5 hover:opacity-70 transition-opacity"
          style={{ color: "var(--color-text-muted)" }}
        >
          <Icon name="x" size={16} />
        </button>
      </div>
    </div>
  );
}
