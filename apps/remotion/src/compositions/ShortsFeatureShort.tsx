import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../brand";

const BEATS = [
  { startSec: 0, text: "Shorts.", sub: "Kurz. Direkt. Dein Format.", color: BRAND.green },
  { startSec: 5, text: "Vertical.", sub: "1080 × 1920 · 60 fps · HLS", color: "#60a5fa" },
  { startSec: 10, text: "Play.", sub: "Selbst gehostet. Immer dein.", color: BRAND.green },
];

function Pill({ text, color, delay, frame, fps }: { text: string; color: string; delay: number; frame: number; fps: number }) {
  const p = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.8 } });
  return (
    <div
      style={{
        background: color,
        color: BRAND.navy,
        padding: "16px 48px",
        borderRadius: 999,
        fontSize: 36,
        fontWeight: 800,
        transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`,
        opacity: interpolate(p, [0, 1], [0, 1]),
        whiteSpace: "nowrap",
      }}
    >
      {text}
    </div>
  );
}

export const ShortsFeatureShort: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.navy,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* Animated gradient background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `
            radial-gradient(ellipse at 50% 30%, rgba(63,228,139,0.12) 0%, transparent 55%),
            radial-gradient(ellipse at 80% 80%, rgba(96,165,250,0.08) 0%, transparent 50%)
          `,
        }}
      />

      {BEATS.map((beat) => {
        const startF = Math.round(fps * beat.startSec);
        const dur = Math.round(fps * 5);
        const progress = spring({ frame: frame - startF, fps, config: { damping: 12 } });
        const titleY = interpolate(progress, [0, 1], [60, 0]);
        const opacity = interpolate(progress, [0, 0.4], [0, 1], { extrapolateRight: "clamp" });
        const exitOpacity = interpolate(
          frame,
          [startF + dur - fps * 0.8, startF + dur],
          [1, 0],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );

        return (
          <Sequence key={beat.startSec} from={startF} durationInFrames={dur}>
            <AbsoluteFill
              style={{
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: 32,
                opacity: exitOpacity,
              }}
            >
              <h1
                style={{
                  fontSize: 128,
                  fontWeight: 900,
                  color: beat.color,
                  margin: 0,
                  letterSpacing: "-3px",
                  transform: `translateY(${titleY}px)`,
                  opacity,
                }}
              >
                {beat.text}
              </h1>
              <p
                style={{
                  fontSize: 40,
                  color: BRAND.light,
                  margin: 0,
                  opacity: opacity * 0.8,
                  transform: `translateY(${interpolate(progress, [0, 1], [40, 0])}px)`,
                  textAlign: "center",
                  padding: "0 60px",
                }}
              >
                {beat.sub}
              </p>
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* Pill row at bottom */}
      <Sequence from={Math.round(fps * 12)} durationInFrames={Math.round(fps * 3)}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "flex-end",
            flexDirection: "column",
            paddingBottom: 120,
            gap: 20,
          }}
        >
          <Pill text="ITSWEBER Play" color={BRAND.green} delay={0} frame={frame - fps * 12} fps={fps} />
          <Pill text="play.itsweber.net" color={BRAND.light} delay={8} frame={frame - fps * 12} fps={fps} />
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
