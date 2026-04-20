"use client";

// Textarea mit @-Mention-Autocomplete. Beim Tippen nach "@" öffnet sich eine
// kleine Dropdown-Liste mit passenden Usern (trpc.user.search). Tab/Enter
// vervollständigt, Escape schließt.

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type TextareaHTMLAttributes,
} from "react";
import { trpc } from "@/lib/trpc";

type TextareaProps = Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange" | "value" | "ref"
>;

interface Props extends TextareaProps {
  value: string;
  onChange: (next: string) => void;
}

interface MentionState {
  active: boolean;
  start: number;
  query: string;
}

export function MentionTextarea({ value, onChange, onKeyDown, ...rest }: Props) {
  const [state, setState] = useState<MentionState>({
    active: false,
    start: 0,
    query: "",
  });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const internalRef = useRef<HTMLTextAreaElement | null>(null);

  const setRef = useCallback((el: HTMLTextAreaElement | null) => {
    internalRef.current = el;
  }, []);

  const results = trpc.user.search.useQuery(
    { q: state.query, limit: 6 },
    { enabled: state.active && state.query.length >= 1, staleTime: 30_000 },
  );

  useEffect(() => {
    setSelectedIdx(0);
  }, [state.query]);

  function parseMention(text: string, caret: number): MentionState {
    let i = caret - 1;
    while (i >= 0) {
      const ch = text[i];
      if (!ch) break;
      if (ch === "@") {
        const prev = i > 0 ? text[i - 1] : " ";
        if (prev === " " || prev === "\n" || i === 0) {
          return {
            active: true,
            start: i,
            query: text.slice(i + 1, caret),
          };
        }
        break;
      }
      if (ch === " " || ch === "\n") break;
      i--;
    }
    return { active: false, start: 0, query: "" };
  }

  function handleChange(e: ChangeEvent<HTMLTextAreaElement>) {
    const next = e.target.value;
    onChange(next);
    const caret = e.target.selectionStart ?? next.length;
    setState(parseMention(next, caret));
  }

  function completeWith(handle: string) {
    if (!state.active) return;
    const before = value.slice(0, state.start);
    const after = value.slice(state.start + 1 + state.query.length);
    const insert = `@${handle} `;
    const next = `${before}${insert}${after}`;
    onChange(next);
    const newCaret = before.length + insert.length;
    setState({ active: false, start: 0, query: "" });
    requestAnimationFrame(() => {
      const el = internalRef.current;
      if (el) {
        el.focus();
        el.selectionStart = el.selectionEnd = newCaret;
      }
    });
  }

  function handleKey(e: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(e);
    if (!state.active) return;
    const rows = results.data ?? [];
    if (e.key === "Escape") {
      e.preventDefault();
      setState({ active: false, start: 0, query: "" });
      return;
    }
    if (rows.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIdx((i) => (i + 1) % rows.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIdx((i) => (i - 1 + rows.length) % rows.length);
    } else if (e.key === "Enter" || e.key === "Tab") {
      const selected = rows[selectedIdx];
      if (selected) {
        e.preventDefault();
        completeWith(selected.handle);
      }
    }
  }

  const rows = results.data ?? [];
  const showMenu = state.active && state.query.length >= 1 && rows.length > 0;

  return (
    <div className="relative">
      <textarea
        ref={setRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKey}
        {...(rest as Record<string, unknown>)}
      />
      {showMenu && (
        <ul
          role="listbox"
          aria-label="Nutzer-Vorschläge"
          className="absolute bottom-full left-0 z-20 mb-1 max-h-60 w-72 overflow-auto rounded-md border border-border bg-surface-raised shadow-lg"
        >
          {rows.map((u, i) => (
            <li
              key={u.id}
              role="option"
              aria-selected={i === selectedIdx ? true : false}
              onMouseDown={(e) => {
                e.preventDefault();
                completeWith(u.handle);
              }}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm ${
                i === selectedIdx ? "bg-brand/15 text-foreground" : "text-muted hover:bg-surface"
              }`}
            >
              <div className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-teal-500 to-teal-700 text-[10px] font-bold text-neutral-900">
                {u.handle[0]?.toUpperCase() ?? "?"}
              </div>
              <span className="min-w-0 truncate">
                <span className="font-semibold text-foreground">{u.displayName}</span>
                <span className="mono ml-2 text-dim">@{u.handle}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
