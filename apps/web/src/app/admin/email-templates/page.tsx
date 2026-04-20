"use client";

import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { AdminGate } from "@/components/admin-gate";
import { toast } from "@/lib/toast";

// ─── Icons ──────────────────────────────────────────────────────────────────

function CodeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" />
    </svg>
  );
}
function EyeIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function RefreshIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4.95" />
    </svg>
  );
}
function SendIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ─── Types ───────────────────────────────────────────────────────────────────

type TemplateVar = { name: string; description: string; example: string };
type TemplateMeta = { id: string; label: string; description: string; vars: TemplateVar[] };
type TemplateRow = { id: string; subject: string; updatedAt: string | Date; meta: TemplateMeta };

// ─── Page ────────────────────────────────────────────────────────────────────

export default function EmailTemplatesPage() {
  return (
    <AdminGate>
      <EmailTemplatesEditor />
    </AdminGate>
  );
}

function EmailTemplatesEditor() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const list = trpc.admin.emailTemplates.list.useQuery();

  useEffect(() => {
    if (list.data && list.data.length > 0 && !selectedId) {
      setSelectedId(list.data[0]!.id);
    }
  }, [list.data, selectedId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[24px] font-extrabold tracking-tight">E-Mail-Templates</h1>
        <p className="mt-1 text-sm text-muted">
          Passe Betreff, HTML und Plaintext der System-Mails an. Variablen per{" "}
          <code className="mono rounded bg-surface-raised px-1 text-xs text-brand">{"{{variablenName}}"}</code> einsetzen.
        </p>
      </header>

      {list.isPending ? (
        <p className="text-muted">Lädt …</p>
      ) : list.error ? (
        <p className="text-danger">Fehler: {list.error.message}</p>
      ) : (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {/* Sidebar: Template-Liste — auf Mobile scrollbare Chip-Row, auf Desktop vertikale Liste */}
          <div className="-mx-1 flex w-full shrink-0 gap-1.5 overflow-x-auto px-1 pb-1 md:mx-0 md:w-56 md:flex-col md:space-y-1 md:overflow-visible md:px-0 md:pb-0">
            {(list.data as TemplateRow[]).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={
                  "shrink-0 rounded-lg px-3 py-2.5 text-left text-sm transition md:w-full md:shrink " +
                  (selectedId === t.id
                    ? "bg-brand/15 text-brand font-semibold"
                    : "text-muted hover:bg-surface-raised hover:text-foreground")
                }
              >
                <div className="truncate font-medium">{t.meta.label}</div>
                <div className="hidden truncate text-[11px] opacity-70 md:block">{t.meta.description}</div>
              </button>
            ))}
          </div>

          {/* Editor Panel */}
          <div className="min-w-0 flex-1">
            {selectedId && <TemplateEditPanel key={selectedId} templateId={selectedId} onSaved={() => list.refetch()} />}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Editor Panel ─────────────────────────────────────────────────────────────

type EditorTab = "visual" | "html" | "text" | "preview";

function TemplateEditPanel({ templateId, onSaved }: { templateId: string; onSaved: () => void }) {
  const utils = trpc.useUtils();
  const tpl = trpc.admin.emailTemplates.get.useQuery({ id: templateId });
  const update = trpc.admin.emailTemplates.update.useMutation({
    onSuccess: () => { toast.success("Template gespeichert"); onSaved(); utils.admin.emailTemplates.get.invalidate({ id: templateId }); },
    onError: (err) => toast.error(err.message),
  });
  const reset = trpc.admin.emailTemplates.reset.useMutation({
    onSuccess: () => {
      toast.success("Template zurückgesetzt");
      onSaved();
      utils.admin.emailTemplates.get.invalidate({ id: templateId });
    },
    onError: (err) => toast.error(err.message),
  });
  const sendPreview = trpc.admin.emailTemplates.sendPreview.useMutation({
    onSuccess: () => toast.success("Vorschau-Mail gesendet"),
    onError: (err) => toast.error(err.message),
  });

  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [textBody, setTextBody] = useState("");
  const [activeTab, setActiveTab] = useState<EditorTab>("visual");
  const [previewEmail, setPreviewEmail] = useState("");
  const [hydrated, setHydrated] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (tpl.data && !hydrated) {
      setSubject(tpl.data.subject);
      setHtmlBody(tpl.data.htmlBody);
      setTextBody(tpl.data.textBody);
      setHydrated(true);
    }
  }, [tpl.data, hydrated]);

  // Reset state when template switches
  useEffect(() => {
    setHydrated(false);
    setActiveTab("visual");
    setConfirmReset(false);
  }, [templateId]);

  if (tpl.isPending || !hydrated) {
    return <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">Lädt …</div>;
  }
  if (tpl.error) {
    return <div className="rounded-xl border border-border bg-surface p-6 text-sm text-danger">{tpl.error.message}</div>;
  }

  const meta = tpl.data!.meta;
  const isDirty = subject !== tpl.data!.subject || htmlBody !== tpl.data!.htmlBody || textBody !== tpl.data!.textBody;

  function handleSave() {
    update.mutate({ id: templateId, subject, htmlBody, textBody });
  }

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-border px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-foreground">{meta.label}</span>
            {isDirty && <span className="rounded-full bg-brand/20 px-2 py-0.5 text-[10px] font-semibold text-brand">Ungespeichert</span>}
          </div>
          <p className="text-xs text-muted mt-0.5">{meta.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
          {confirmReset ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-danger">Zurücksetzen?</span>
              <button
                type="button"
                onClick={() => { reset.mutate({ id: templateId }); setConfirmReset(false); setHydrated(false); }}
                disabled={reset.isPending}
                className="rounded-lg bg-danger px-2.5 py-1 text-xs font-semibold text-white hover:bg-danger/80 disabled:opacity-50"
              >
                Ja
              </button>
              <button type="button" onClick={() => setConfirmReset(false)} className="text-xs text-muted hover:text-foreground">Nein</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              className="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted transition hover:border-border-strong hover:text-foreground"
            >
              <RefreshIcon /> Standard
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={update.isPending || !isDirty}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-neutral-900 shadow-[0_0_12px_rgba(63,228,139,0.3)] transition hover:bg-brand-hover disabled:opacity-50"
          >
            {update.isPending ? "Speichert …" : "Speichern"}
          </button>
        </div>
      </div>

      {/* Betreff */}
      <div className="border-b border-border px-5 py-3">
        <label className="block space-y-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Betreff</span>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-foreground outline-none focus:border-brand"
          />
        </label>
      </div>

      {/* Tab-Bar */}
      <div className="flex overflow-x-auto border-b border-border px-5">
        {(["visual", "html", "text", "preview"] as EditorTab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={
              "flex shrink-0 items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition " +
              (activeTab === tab
                ? "border-brand text-brand"
                : "border-transparent text-muted hover:text-foreground")
            }
          >
            {tab === "html" && <CodeIcon />}
            {tab === "preview" && <EyeIcon />}
            {tab === "visual" ? "Visuell" : tab === "html" ? "HTML" : tab === "text" ? "Plaintext" : "Vorschau"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="p-0">
        {activeTab === "visual" && (
          <VisualEditor html={htmlBody} onChange={setHtmlBody} />
        )}
        {activeTab === "html" && (
          <CodeEditor
            value={htmlBody}
            onChange={setHtmlBody}
            language="html"
            placeholder="HTML-Inhalt …"
          />
        )}
        {activeTab === "text" && (
          <CodeEditor
            value={textBody}
            onChange={setTextBody}
            language="text"
            placeholder="Plaintext-Inhalt …"
          />
        )}
        {activeTab === "preview" && (
          <PreviewPanel html={htmlBody} />
        )}
      </div>

      {/* Variablen-Referenz */}
      <div className="border-t border-border px-5 py-4">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Verfügbare Variablen</p>
        <div className="flex flex-wrap gap-2">
          {meta.vars.map((v) => (
            <button
              key={v.name}
              type="button"
              title={`${v.description} — Beispiel: ${v.example}`}
              onClick={() => {
                const tag = `{{${v.name}}}`;
                if (activeTab === "text") setTextBody((prev) => prev + tag);
                else if (activeTab === "html" || activeTab === "visual") setHtmlBody((prev) => prev + tag);
              }}
              className="rounded-md border border-brand/30 bg-brand/10 px-2 py-0.5 font-mono text-[11px] text-brand transition hover:bg-brand/20"
            >
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-dim">Klick auf eine Variable fügt sie ans Ende des aktiven Editors ein. Hover für Beschreibung + Beispielwert.</p>
      </div>

      {/* Vorschau-Mail senden */}
      <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3">
        <span className="text-xs text-muted">Vorschau-Mail senden an:</span>
        <input
          type="email"
          value={previewEmail}
          onChange={(e) => setPreviewEmail(e.target.value)}
          placeholder="deine@email.de"
          className="w-full min-w-0 flex-1 rounded-lg border border-border bg-surface-raised px-3 py-1.5 text-sm text-foreground outline-none focus:border-brand sm:w-56 sm:flex-none"
        />
        <button
          type="button"
          disabled={!previewEmail || sendPreview.isPending}
          onClick={() => sendPreview.mutate({ id: templateId, to: previewEmail })}
          className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-muted transition hover:border-brand hover:text-brand disabled:opacity-50"
        >
          <SendIcon /> {sendPreview.isPending ? "Sendet …" : "Senden"}
        </button>
        <span className="text-[11px] text-dim">Mit Beispiel-Werten aus der Variablen-Referenz</span>
      </div>
    </div>
  );
}

// ─── Visual Editor (contenteditable mit Toolbar) ─────────────────────────────

function VisualEditor({ html, onChange }: { html: string; onChange: (v: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const lastHtml = useRef(html);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== html && lastHtml.current !== html) {
      ref.current.innerHTML = html;
      lastHtml.current = html;
    }
  }, [html]);

  function exec(cmd: string, val?: string) {
    document.execCommand(cmd, false, val);
    ref.current?.focus();
  }

  return (
    <div className="border-b border-border">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-background/40 px-3 py-1.5">
        <ToolbarBtn title="Fett" onClick={() => exec("bold")}><b>B</b></ToolbarBtn>
        <ToolbarBtn title="Kursiv" onClick={() => exec("italic")}><i>I</i></ToolbarBtn>
        <ToolbarBtn title="Unterstrichen" onClick={() => exec("underline")}><u>U</u></ToolbarBtn>
        <div className="mx-1.5 h-4 w-px bg-border" />
        <ToolbarBtn title="Link einfügen" onClick={() => { const url = prompt("URL:", "https://"); if (url) exec("createLink", url); }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Link entfernen" onClick={() => exec("unlink")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M18.84 12.25l1.72-1.71h-.02a5.004 5.004 0 0 0-.12-7.07 5.006 5.006 0 0 0-6.95 0l-1.72 1.71"/><path d="M5.17 11.75l-1.71 1.71a5.004 5.004 0 0 0 .12 7.07 5.006 5.006 0 0 0 6.95 0l1.71-1.71"/><line x1="8" y1="2" x2="2" y2="8"/><line x1="22" y1="16" x2="16" y2="22"/></svg>
        </ToolbarBtn>
        <div className="mx-1.5 h-4 w-px bg-border" />
        <ToolbarBtn title="Geordnete Liste" onClick={() => exec("insertOrderedList")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4"/><path d="M4 10h2"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Ungeordnete Liste" onClick={() => exec("insertUnorderedList")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
        </ToolbarBtn>
        <div className="mx-1.5 h-4 w-px bg-border" />
        <ToolbarBtn title="Rückgängig" onClick={() => exec("undo")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="9 14 4 9 9 4"/><path d="M20 20v-7a4 4 0 0 0-4-4H4"/></svg>
        </ToolbarBtn>
        <ToolbarBtn title="Wiederholen" onClick={() => exec("redo")}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><polyline points="15 14 20 9 15 4"/><path d="M4 20v-7a4 4 0 0 1 4-4h12"/></svg>
        </ToolbarBtn>
      </div>
      {/* Editable Area */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => {
          const v = ref.current?.innerHTML ?? "";
          lastHtml.current = v;
          onChange(v);
        }}
        className="min-h-[320px] p-5 text-sm text-foreground outline-none [&_a]:text-brand [&_a]:underline [&_b]:font-bold [&_i]:italic [&_u]:underline [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5"
        style={{ fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif" }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function ToolbarBtn({ title, onClick, children }: { title: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className="flex h-7 w-7 items-center justify-center rounded text-xs text-muted transition hover:bg-surface hover:text-foreground"
    >
      {children}
    </button>
  );
}

// ─── Code Editor ─────────────────────────────────────────────────────────────

function CodeEditor({ value, onChange, language, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  language: string;
  placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      spellCheck={false}
      aria-label={`${language}-Editor`}
      className="mono block min-h-[360px] w-full resize-y border-b border-border bg-background/60 p-5 text-[13px] text-foreground outline-none placeholder:text-dim focus:border-brand"
      style={{ fontFamily: "'SFMono-Regular', Consolas, Monaco, monospace" }}
    />
  );
}

// ─── Preview Panel ────────────────────────────────────────────────────────────

function PreviewPanel({ html }: { html: string }) {
  return (
    <div className="border-b border-border">
      <div className="flex items-center gap-2 border-b border-border bg-background/40 px-5 py-2">
        <EyeIcon />
        <span className="text-xs text-muted">Live-Vorschau (aktueller HTML-Inhalt, unskaliert)</span>
      </div>
      <iframe
        title="E-Mail-Vorschau"
        srcDoc={html}
        sandbox="allow-same-origin"
        className="h-[480px] w-full border-0 bg-white"
      />
    </div>
  );
}
