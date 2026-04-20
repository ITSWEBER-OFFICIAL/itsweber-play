# AI-Moderation (Comments)

Stub-Implementierung in Session K. Aktiv, wenn `OLLAMA_URL` gesetzt ist;
sonst sind Scoring-Felder leer und die Admin-Queue filtert nichts.

## Flow

1. User postet einen Kommentar (`comment.create`).
2. API enqueued einen `moderate-comment`-Job via BullMQ (nur wenn `OLLAMA_URL` gesetzt).
3. Worker ruft `POST {OLLAMA_URL}/api/generate` mit dem konfigurierten Modell auf (`OLLAMA_MODERATION_MODEL`, Default `llama3.2:3b`).
4. Antwort wird als JSON geparst: `{ label: "SAFE"|"SUSPICIOUS"|"TOXIC", score: 0..1, reason? }`.
5. Worker schreibt `Comment.moderationLabel` + `Comment.moderationScore`.

## Score-Thresholds

| Label | Score | Interpretation |
|---|---|---|
| SAFE | ≤ 0.3 | Unbedenklich |
| SUSPICIOUS | 0.3 < score ≤ 0.7 | Grenzfall: Spam, Off-Topic |
| TOXIC | > 0.7 | Hass, Belästigung, illegal |

Default-Grenzwert für Admin-Auto-Hide: `score >= 0.7 AND label = "TOXIC"`.

## Env-Variablen

| Name | Default | Zweck |
|---|---|---|
| `OLLAMA_URL` | _leer_ | Basis-URL des Ollama-Servers (z. B. `http://ollama:11434`). Leer = Feature aus. |
| `OLLAMA_MODERATION_MODEL` | `llama3.2:3b` | Modell-Name (muss auf dem Ollama-Host `ollama pull`-ed sein). |
| `MODERATE_CONCURRENCY` | `2` | BullMQ-Worker-Concurrency für den Queue. |

## Fallback-Verhalten

- Keine Env → Job sofort als `{ ok: true }` beendet, keine DB-Schreibung.
- Ollama nicht erreichbar / Response nicht parsbar → Job landet in Failed-Queue, Comment bleibt ohne Score sichtbar.
- Das absichtlich tolerante Verhalten stellt sicher, dass AI-Ausfall die Plattform nicht blockiert.

## Prompt-Design

```
Du bist ein Moderations-Klassifikator. Analysiere den folgenden Kommentar
und antworte AUSSCHLIESSLICH als JSON mit Feldern:
  {"label":"SAFE|SUSPICIOUS|TOXIC","score":0..1,"reason":"kurz"}.
...
```

Prompt wird mit `format: "json"` an Ollama gesendet → erzwingt valides JSON
in der Response. Kein Jailbreak-Schutz nötig; Worker akzeptiert nur die
drei vorgesehenen Labels, sonst wird das Ergebnis verworfen.
