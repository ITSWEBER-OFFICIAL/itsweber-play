// AI-Moderation-Stub. Ruft Ollama (llama3.2:3b) auf, lässt den Comment-Body
// als SAFE/SUSPICIOUS/TOXIC klassifizieren und schreibt Score+Label zurück.
// Gated via `OLLAMA_URL` env — fehlt die Variable, wird der Job sofort no-op.

import type { Job } from "bullmq";
import { prisma } from "@play/db";
import type { ModerateCommentJobData } from "../queue";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "";
const OLLAMA_MODEL = process.env.OLLAMA_MODERATION_MODEL ?? "llama3.2:3b";

const PROMPT = `Du bist ein Moderations-Klassifikator. Analysiere den folgenden
Kommentar und antworte AUSSCHLIESSLICH als JSON mit Feldern:
  {"label":"SAFE|SUSPICIOUS|TOXIC","score":0..1,"reason":"kurz"}.
- SAFE = unbedenklich (score ≤ 0.3)
- SUSPICIOUS = Grenzfall, Spam, Off-Topic (0.3 < score ≤ 0.7)
- TOXIC = Hass, Belästigung, Gewaltandrohung, illegal (score > 0.7)
Antworte nur mit dem JSON, keine weiteren Worte.

Kommentar:
"""
{{BODY}}
"""`;

interface OllamaResult {
  label: "SAFE" | "SUSPICIOUS" | "TOXIC";
  score: number;
  reason?: string;
}

async function classify(body: string): Promise<OllamaResult | null> {
  if (!OLLAMA_URL) return null;
  const prompt = PROMPT.replace("{{BODY}}", body.slice(0, 2000));
  try {
    const res = await fetch(`${OLLAMA_URL.replace(/\/$/, "")}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        prompt,
        stream: false,
        format: "json",
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { response?: string };
    const raw = data.response ?? "";
    const parsed = JSON.parse(raw) as Partial<OllamaResult>;
    if (!parsed.label || typeof parsed.score !== "number") return null;
    return {
      label: parsed.label,
      score: Math.max(0, Math.min(1, parsed.score)),
      reason: parsed.reason,
    };
  } catch {
    return null;
  }
}

export async function processModerateComment(
  job: Job<ModerateCommentJobData>,
): Promise<{ ok: boolean; label?: string; score?: number }> {
  if (!OLLAMA_URL) return { ok: true };
  const comment = await prisma.comment.findUnique({
    where: { id: job.data.commentId },
    select: { id: true, body: true, deletedAt: true },
  });
  if (!comment || comment.deletedAt) return { ok: true };
  const result = await classify(comment.body);
  if (!result) return { ok: false };

  await prisma.comment.update({
    where: { id: comment.id },
    data: {
      moderationLabel: result.label,
      moderationScore: result.score,
    },
  });
  return { ok: true, label: result.label, score: result.score };
}
