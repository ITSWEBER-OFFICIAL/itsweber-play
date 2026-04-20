// Magic-Bytes-Validator für Upload-Handler.
//
// `Content-Type`-Header lügt (Browser/Curl schicken, was der Nutzer angibt).
// Wir validieren zusätzlich die ersten ~4 KB gegen die echten File-Signaturen
// via `file-type`. Schützt gegen maliziöse Uploads wie `<script>…</script>`
// umbenannt in `.png` → kein Rendering-Angriff im Frontend, kein SVG-XSS,
// keine polyglotten PDF/JS-Uploads in einen Image-Bucket.
//
// Für kleine Assets (Logo/Avatar/Banner/Thumb/Caption) puffern wir den ganzen
// Body (alle ≤ 4 MB). Für große Video-Bodies peeken wir nur den Anfang und
// bauen einen Replay-Stream, damit der Upload weiterstreamt.

import { Readable } from "node:stream";
import { fileTypeFromBuffer } from "file-type";
import type { FastifyRequest } from "fastify";

export interface MagicBytesResult {
  ok: boolean;
  detectedMime: string | null;
  reason?: "HEADER_MISMATCH" | "UNKNOWN_FORMAT";
}

/**
 * Vollpuffer-Variante: liest den gesamten request.raw in ein Buffer (Limit via
 * maxBytes), prüft Magic-Bytes und gibt Body + Detection zurück. Geeignet für
 * Dateien bis ~4 MB (Logo/Avatar/Banner/Thumb/Caption).
 */
export async function readAndValidateMime(
  request: FastifyRequest,
  allowedMimes: ReadonlySet<string>,
  maxBytes: number,
): Promise<
  | { ok: true; buffer: Buffer; detectedMime: string }
  | { ok: false; status: number; error: string; hint?: string }
> {
  const chunks: Buffer[] = [];
  let received = 0;
  for await (const chunk of request.raw) {
    const buf = chunk as Buffer;
    received += buf.length;
    if (received > maxBytes) {
      return { ok: false, status: 413, error: "PAYLOAD_TOO_LARGE" };
    }
    chunks.push(buf);
  }
  const buffer = Buffer.concat(chunks);
  const ft = await fileTypeFromBuffer(buffer);
  if (!ft) {
    return {
      ok: false,
      status: 415,
      error: "UNSUPPORTED_MEDIA_TYPE",
      hint: "Magic-Bytes nicht erkannt — kein valides Bild/Caption.",
    };
  }
  if (!allowedMimes.has(ft.mime)) {
    return {
      ok: false,
      status: 415,
      error: "UNSUPPORTED_MEDIA_TYPE",
      hint: `Echter Content-Type ist ${ft.mime} — erlaubt: ${[...allowedMimes].join(", ")}.`,
    };
  }
  return { ok: true, buffer, detectedMime: ft.mime };
}

/**
 * Streaming-Variante: peekt die ersten peekBytes, prüft Magic-Bytes, und
 * liefert einen Ersatz-Readable, der zuerst den gepeekten Buffer emittet und
 * dann aus request.raw weitermacht. Geeignet für große Video-Uploads.
 */
export async function peekAndValidateMime(
  request: FastifyRequest,
  allowedMimePrefix: string,
  peekBytes = 4100,
): Promise<
  | { ok: true; stream: Readable; detectedMime: string }
  | { ok: false; status: number; error: string; hint?: string }
> {
  const raw = request.raw;
  const peeked: Buffer[] = [];
  let peekedLen = 0;

  while (peekedLen < peekBytes) {
    const chunk: Buffer | null = raw.read(peekBytes - peekedLen);
    if (chunk === null) {
      // Warte auf 'readable' oder 'end'.
      const more: Buffer | undefined = await new Promise((resolve) => {
        const onReadable = () => {
          raw.off("end", onEnd);
          resolve(undefined);
        };
        const onEnd = () => {
          raw.off("readable", onReadable);
          resolve(undefined);
        };
        raw.once("readable", onReadable);
        raw.once("end", onEnd);
      });
      if (more === undefined && raw.readableEnded) break;
      continue;
    }
    peeked.push(chunk);
    peekedLen += chunk.length;
  }
  const head = Buffer.concat(peeked);
  const ft = await fileTypeFromBuffer(head);
  if (!ft) {
    return {
      ok: false,
      status: 415,
      error: "UNSUPPORTED_MEDIA_TYPE",
      hint: "Magic-Bytes nicht erkannt — kein valides Video.",
    };
  }
  if (!ft.mime.startsWith(allowedMimePrefix)) {
    return {
      ok: false,
      status: 415,
      error: "UNSUPPORTED_MEDIA_TYPE",
      hint: `Echter Content-Type ist ${ft.mime}, erwartet ${allowedMimePrefix}*.`,
    };
  }

  // Replay-Stream: erst den gepeekten Head, dann den Rest aus raw.
  async function* replay() {
    yield head;
    for await (const chunk of raw) {
      yield chunk as Buffer;
    }
  }
  return { ok: true, stream: Readable.from(replay()), detectedMime: ft.mime };
}
