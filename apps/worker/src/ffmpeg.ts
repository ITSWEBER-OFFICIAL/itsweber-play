import ffmpegPath from "@ffmpeg-installer/ffmpeg";
import ffprobePath from "@ffprobe-installer/ffprobe";
import ffmpeg from "fluent-ffmpeg";

// Portable ffmpeg/ffprobe via Installer-Pakete — kein System-Install nötig.
// Worker-Container in Prod bringt ffmpeg nativ mit; dieser Pfad ist nur die
// lokale-Dev-Brücke. Bei Env-Override (FFMPEG_PATH) gewinnt das.
const resolvedFfmpeg = process.env.FFMPEG_PATH || ffmpegPath.path;
const resolvedFfprobe = process.env.FFPROBE_PATH || ffprobePath.path;

ffmpeg.setFfmpegPath(resolvedFfmpeg);
ffmpeg.setFfprobePath(resolvedFfprobe);

export { ffmpeg };

export interface ProbeResult {
  durationSec: number;
  width: number;
  height: number;
  codec: string | null;
  bitrateKbps: number | null;
}

export function probe(input: string): Promise<ProbeResult> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(input, (err, data) => {
      if (err) return reject(err);
      const videoStream = data.streams.find((s) => s.codec_type === "video");
      if (!videoStream) {
        return reject(new Error("No video stream in source"));
      }
      resolve({
        durationSec: Math.round(Number(data.format.duration ?? 0)),
        width: videoStream.width ?? 0,
        height: videoStream.height ?? 0,
        codec: videoStream.codec_name ?? null,
        bitrateKbps: data.format.bit_rate
          ? Math.round(Number(data.format.bit_rate) / 1000)
          : null,
      });
    });
  });
}

export type VariantCodec = "h264" | "av1" | "vp9";

export interface HlsVariant {
  name: string; // "1080p" | "720p-av1" | …
  height: number;
  videoBitrateKbps: number;
  codec: VariantCodec;
}

// H.264 ist universell kompatibel (Safari, iOS, ältere Android). AV1/VP9
// sparen Bandbreite, kosten aber viel CPU. Hinter Env-Flag TRANSCODE_EXTRA_CODECS
// ("av1" und/oder "vp9") werden zusätzliche Varianten pro Auflösung gerendert.
// Master-Playlist listet sie per #EXT-X-STREAM-INF — Player (hls.js / Safari)
// wählt nach CODECS-Attribut.
function parseExtraCodecs(): VariantCodec[] {
  const raw = (process.env.TRANSCODE_EXTRA_CODECS ?? "").toLowerCase().trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((c) => c.trim())
    .filter((c): c is "av1" | "vp9" => c === "av1" || c === "vp9");
}

export function selectVariants(sourceHeight: number): HlsVariant[] {
  const baseH264: HlsVariant[] = [
    { name: "1080p", height: 1080, videoBitrateKbps: 5000, codec: "h264" },
    { name: "720p", height: 720, videoBitrateKbps: 2800, codec: "h264" },
    { name: "480p", height: 480, videoBitrateKbps: 1200, codec: "h264" },
  ];
  const fits = baseH264.filter((v) => v.height <= sourceHeight);
  const h264 = fits.length > 0 ? fits : [baseH264[baseH264.length - 1]!];

  const extra = parseExtraCodecs();
  if (extra.length === 0) return h264;

  // AV1/VP9 — jeweils 30-40 % geringere Bitrate als H.264 bei vergleichbarer
  // Qualität (Chip-Herstellerangaben, variiert je Content). Wir setzen
  // konservativ −30 %.
  const extraVariants: HlsVariant[] = [];
  for (const v of h264) {
    for (const c of extra) {
      extraVariants.push({
        name: `${v.height}p-${c}`,
        height: v.height,
        videoBitrateKbps: Math.round(v.videoBitrateKbps * 0.7),
        codec: c,
      });
    }
  }
  return [...h264, ...extraVariants];
}

/**
 * Generiert HLS-Varianten parallel (je Variante ein eigener ffmpeg-Call).
 * Master-Playlist wird danach manuell geschrieben — ffmpeg's `-var_stream_map`
 * wäre performanter, ist aber in fluent-ffmpeg nicht 1st-class supported.
 */
function codecOptions(variant: HlsVariant): string[] {
  switch (variant.codec) {
    case "h264":
      return ["-c:v libx264", "-preset medium", "-crf 22"];
    case "av1":
      // libsvtav1 ist um Größenordnungen schneller als libaom-av1.
      // CRF 30 entspricht grob H.264 CRF 22 bei AV1.
      return ["-c:v libsvtav1", "-preset 8", "-crf 30"];
    case "vp9":
      return ["-c:v libvpx-vp9", "-deadline good", "-cpu-used 2", "-crf 32", "-b:v 0"];
  }
}

export function transcodeVariant(
  input: string,
  outputDir: string,
  variant: HlsVariant,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .outputOptions([
        "-map 0:v:0",
        "-map 0:a:0?", // optional audio
        `-vf scale=-2:${variant.height}`,
        ...codecOptions(variant),
        `-maxrate ${variant.videoBitrateKbps}k`,
        `-bufsize ${variant.videoBitrateKbps * 2}k`,
        "-c:a aac",
        "-b:a 128k",
        "-f hls",
        "-hls_time 4",
        "-hls_playlist_type vod",
        "-hls_segment_type fmp4",
        "-hls_flags independent_segments",
        `-hls_segment_filename ${outputDir}/${variant.name}/seg-%03d.m4s`,
        `-hls_fmp4_init_filename init.mp4`,
      ])
      .output(`${outputDir}/${variant.name}/playlist.m3u8`)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

/**
 * Single frame at a given timestamp — scaled to 1280-wide webp.
 * The Studio video-editor picks between several of these via `extractThumbnailCandidates`.
 */
export function extractFrameAt(
  input: string,
  outputFile: string,
  seekSec: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(input)
      .seekInput(Math.max(0, seekSec))
      .frames(1)
      .outputOptions(["-vf scale=1280:-2", "-q:v 4"])
      .output(outputFile)
      .on("end", () => resolve())
      .on("error", reject)
      .run();
  });
}

/**
 * Generate 5 thumbnail candidates at 10 %, 30 %, 50 %, 70 %, 90 % of the video.
 * Returns the list of absolute file paths that were written. The Studio video-
 * editor lets the creator pick between them; the selected key ends up in
 * `Video.thumbnailKey`, the others stay in `Video.thumbnailCandidates` so the
 * creator can switch without a re-render.
 */
export async function extractThumbnailCandidates(
  input: string,
  outputDir: string,
  durationSec: number,
): Promise<string[]> {
  const fractions = [0.1, 0.3, 0.5, 0.7, 0.9];
  const written: string[] = [];
  for (let i = 0; i < fractions.length; i++) {
    const frac = fractions[i]!;
    const seek = Math.max(1, Math.floor(durationSec * frac));
    const out = `${outputDir}/thumb-${i + 1}.webp`;
    await extractFrameAt(input, out, seek);
    written.push(out);
  }
  return written;
}

/**
 * Legacy single-shot thumbnail (kept for tooling that still calls it).
 * Extract at 50 % duration.
 */
export function extractThumbnail(
  input: string,
  outputFile: string,
  durationSec: number,
): Promise<void> {
  return extractFrameAt(
    input,
    outputFile,
    Math.max(1, Math.floor(durationSec / 2)),
  );
}
