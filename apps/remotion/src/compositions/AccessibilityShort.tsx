import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../brand";

const A11Y_FEATURES = [
  { icon: "💬", label: "Automatische Captions", desc: "Whisper-KI transkribiert jedes Video.", startSec: 2 },
  { icon: "⌨️", label: "Tastatur-Navigation", desc: "Vollständig ohne Maus bedienbar.", startSec: 7 },
  { icon: "🔍", label: "Hoher Kontrast", desc: "WCAG 2.2 AA auf allen Key-Pages.", startSec: 12 },
  { icon: "📖", label: "Transcript-Panel", desc: "Volltext neben dem Video.", startSec: 17 },
];

function FeatureCard({ feat, frame, fps }: { feat: (typeof A11Y_FEATURES)[0]; frame: number; fps: number }) {
  const delay = fps * feat.startSec;
  const p = spring({ frame: frame - delay, fps, config: { damping: 14, mass: 0.9 } });
  const opacity = interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
  const scale = interpolate(p, [0, 1], [0.88, 1]);

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.05)",
        border: `1px solid rgba(63,228,139,0.2)`,
        borderRadius: 20,
        padding: "32px 40px",
        display: "flex",
        gap: 24,
        alignItems: "flex-start",
        width: 800,
        opacity,
        transform: `scale(${scale})`,
      }}
    >
      <span style={{ fontSize: 56, flexShrink: 0 }}>{feat.icon}</span>
      <div>
        <div style={{ fontSize: 36, fontWeight: 700, color: BRAND.green, marginBottom: 8 }}>
          {feat.label}
        </div>
        <div style={{ fontSize: 28, color: BRAND.light, opacity: 0.75, lineHeight: 1.4 }}>
          {feat.desc}
        </div>
      </div>
    </div>
  );
}

export const AccessibilityShort: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const titleProgress = spring({ frame, fps, config: { damping: 12 } });
  const titleOpacity = interpolate(titleProgress, [0, 0.5], [0, 1]);
  const titleY = interpolate(titleProgress, [0, 1], [50, 0]);

  const outroOpacity = interpolate(frame, [fps * 18, fps * 19.5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.navy,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
      }}
    >
      {/* BG gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 50% 0%, rgba(63,228,139,0.1) 0%, transparent 60%)`,
        }}
      />

      {/* Title */}
      <Sequence from={0} durationInFrames={fps * 2}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
          }}
        >
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 36, color: BRAND.green, margin: 0, marginBottom: 16, fontWeight: 600 }}>
              ITSWEBER Play
            </p>
            <h1 style={{ fontSize: 80, fontWeight: 900, color: BRAND.white, margin: 0, lineHeight: 1.1 }}>
              Barrierefrei<br />
              <span style={{ color: BRAND.green }}>designed.</span>
            </h1>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Feature cards */}
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          gap: 24,
          padding: "0 60px",
          paddingTop: 80,
        }}
      >
        {A11Y_FEATURES.map((feat) => (
          <FeatureCard key={feat.label} feat={feat} frame={frame} fps={fps} />
        ))}
      </AbsoluteFill>

      {/* Outro */}
      <Sequence from={fps * 18} durationInFrames={fps * 2}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "flex-end",
            flexDirection: "column",
            paddingBottom: 100,
            opacity: outroOpacity,
          }}
        >
          <div
            style={{
              background: BRAND.green,
              color: BRAND.navy,
              padding: "20px 60px",
              borderRadius: 999,
              fontSize: 36,
              fontWeight: 800,
            }}
          >
            play.itsweber.net
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
