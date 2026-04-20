// Renders plaintext mit klickbaren @mentions, #hashtags und URLs. Unkontrollierte
// Eingaben werden als React-Kinder ausgegeben (kein dangerouslySetInnerHTML).

import Link from "next/link";
import type { ReactNode } from "react";

const TOKEN_RE = /(@[a-z0-9_.-]{2,32})|(#[\p{L}\p{N}_-]{2,40})|(https?:\/\/[^\s<]+)/giu;

export function RichText({ children }: { children: string }) {
  const parts: ReactNode[] = [];
  let lastIdx = 0;
  let key = 0;
  const text = children;
  for (const match of text.matchAll(TOKEN_RE)) {
    const start = match.index ?? 0;
    if (start > lastIdx) parts.push(text.slice(lastIdx, start));
    const [full, mention, hashtag, url] = match;
    if (mention) {
      const handle = mention.slice(1);
      parts.push(
        <Link
          key={`m-${key++}`}
          href={`/u/${handle}`}
          className="text-brand hover:underline"
        >
          {mention}
        </Link>,
      );
    } else if (hashtag) {
      const tag = hashtag.slice(1).toLowerCase();
      parts.push(
        <Link
          key={`t-${key++}`}
          href={`/tag/${encodeURIComponent(tag)}`}
          className="text-brand hover:underline"
        >
          {hashtag}
        </Link>,
      );
    } else if (url) {
      parts.push(
        <a
          key={`u-${key++}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-brand hover:underline"
        >
          {url}
        </a>,
      );
    } else {
      parts.push(full);
    }
    lastIdx = start + full.length;
  }
  if (lastIdx < text.length) parts.push(text.slice(lastIdx));
  return <>{parts}</>;
}
