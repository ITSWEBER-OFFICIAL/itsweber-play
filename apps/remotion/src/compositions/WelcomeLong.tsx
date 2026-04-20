import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../brand";

const FEATURES = [
  {
    icon: "🖥️",
    title: "Selbst gehostet",
    desc: "Deine Plattform, deine Daten. Läuft auf deinem Unraid-Server.",
  },
  {
    icon: "🎬",
    title: "Multi-Creator",
    desc: "Mehrere Kanäle, ein Stack. Jeder Creator mit eigenem Branding.",
  },
  {
    icon: "🎨",
    title: "Themes & Branding",
    desc: "6-Ebenen-Design-Token-System. Vollständig anpassbar.",
  },
  {
    icon: "⚡",
    title: "Shorts & Videos",
    desc: "Langer Inhalt und vertikale Shorts — auf einer Plattform.",
  },
  {
    icon: "🔒",
    title: "Privacy-First",
    desc: "Kein Tracking, kein Algorithmus-Lock-in. Open Source (AGPL-3.0).",
  },
];

function AtomLogo({ progress }: { progress: number }) {
  const scale = interpolate(progress, [0, 1], [0.5, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(progress, [0, 0.4, 1], [0, 0.8, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        transform: `scale(${scale})`,
        opacity,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <svg width={120} height={120} viewBox="0 0 120 120" fill="none">
        {/* nucleus */}
        <circle cx={60} cy={60} r={10} fill={BRAND.green} />
        {/* orbit 1 */}
        <ellipse
          cx={60} cy={60} rx={50} ry={20}
          stroke={BRAND.green} strokeWidth={3} fill="none" opacity={0.8}
        />
        {/* orbit 2 — rotated 60° */}
        <ellipse
          cx={60} cy={60} rx={50} ry={20}
          stroke={BRAND.green} strokeWidth={3} fill="none" opacity={0.6}
          transform="rotate(60 60 60)"
        />
        {/* orbit 3 — rotated 120° */}
        <ellipse
          cx={60} cy={60} rx={50} ry={20}
          stroke={BRAND.green} strokeWidth={3} fill="none" opacity={0.4}
          transform="rotate(120 60 60)"
        />
      </svg>
    </div>
  );
}

function FeatureSlide({ feature, enterProgress }: { feature: (typeof FEATURES)[0]; enterProgress: number }) {
  const x = interpolate(enterProgress, [0, 1], [80, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(enterProgress, [0, 0.6, 1], [0, 0.9, 1], { extrapolateRight: "clamp" });
  return (
    <div
      style={{
        transform: `translateX(${x}px)`,
        opacity,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 24,
        padding: "60px 160px",
      }}
    >
      <span style={{ fontSize: 96 }}>{feature.icon}</span>
      <h2
        style={{
          fontSize: 72,
          fontWeight: 800,
          color: BRAND.green,
          textAlign: "center",
          margin: 0,
          letterSpacing: "-1px",
        }}
      >
        {feature.title}
      </h2>
      <p
        style={{
          fontSize: 40,
          color: BRAND.light,
          textAlign: "center",
          margin: 0,
          lineHeight: 1.5,
          maxWidth: 900,
          opacity: 0.85,
        }}
      >
        {feature.desc}
      </p>
    </div>
  );
}

export const WelcomeLong: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoProgress = spring({ frame, fps, config: { damping: 14 } });

  const titleOpacity = interpolate(frame, [fps * 3, fps * 5], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const titleY = interpolate(frame, [fps * 3, fps * 5], [40, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // CTA section (51s+)
  const ctaOpacity = interpolate(frame, [fps * 51, fps * 54], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: BRAND.navy,
        fontFamily: "'Segoe UI', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Background grid */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `
            linear-gradient(rgba(63,228,139,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(63,228,139,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "80px 80px",
        }}
      />

      {/* Logo + Intro (0–15s) */}
      <Sequence from={0} durationInFrames={fps * 15}>
        <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 32 }}>
          <AtomLogo progress={logoProgress} />
          <div style={{ transform: `translateY(${titleY}px)`, opacity: titleOpacity, textAlign: "center" }}>
            <h1 style={{ fontSize: 80, fontWeight: 800, color: BRAND.white, margin: 0, letterSpacing: "-2px" }}>
              ITSWEBER <span style={{ color: BRAND.green }}>Play</span>
            </h1>
            <p style={{ fontSize: 32, color: BRAND.light, opacity: 0.7, marginTop: 16 }}>
              Deine selbst gehostete Video-Plattform
            </p>
          </div>
        </AbsoluteFill>
      </Sequence>

      {/* Feature slides (15–51s) — each 7.2s */}
      {FEATURES.map((feature, i) => {
        const startFrame = fps * (15 + i * 7.2);
        const enterProgress = interpolate(
          frame,
          [startFrame, startFrame + fps * 1.5],
          [0, 1],
          { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
        );
        return (
          <Sequence key={feature.title} from={Math.round(startFrame)} durationInFrames={Math.round(fps * 7.2)}>
            <AbsoluteFill style={{ alignItems: "center", justifyContent: "center" }}>
              <FeatureSlide feature={feature} enterProgress={enterProgress} />
            </AbsoluteFill>
          </Sequence>
        );
      })}

      {/* CTA (51–90s) */}
      <Sequence from={fps * 51} durationInFrames={fps * 39}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 48,
            opacity: ctaOpacity,
          }}
        >
          <AtomLogo progress={1} />
          <div style={{ textAlign: "center" }}>
            <h1 style={{ fontSize: 72, fontWeight: 800, color: BRAND.white, margin: 0 }}>
              Starte jetzt.
            </h1>
            <p style={{ fontSize: 36, color: BRAND.light, opacity: 0.75, marginTop: 20 }}>
              docker compose up &amp;&amp; enjoy
            </p>
          </div>
          <div
            style={{
              background: BRAND.green,
              color: BRAND.navy,
              padding: "20px 56px",
              borderRadius: 12,
              fontSize: 32,
              fontWeight: 700,
            }}
          >
            play.itsweber.net
          </div>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
