import {
  AbsoluteFill,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../brand";

const SECTIONS = [
  {
    title: "Upload",
    sub: "Video oder Short — wähle dein Format",
    icon: "📤",
    color: "#60a5fa",
    startSec: 5,
    durationSec: 10,
  },
  {
    title: "Editor",
    sub: "Trim, Captions, Custom-Thumbnail",
    icon: "✂️",
    color: BRAND.green,
    startSec: 15,
    durationSec: 10,
  },
  {
    title: "Analytics",
    sub: "Views, Watch-Time, Subscriber-Entwicklung",
    icon: "📊",
    color: "#f59e0b",
    startSec: 25,
    durationSec: 10,
  },
  {
    title: "Branding",
    sub: "Banner, Avatar, Accent-Farbe, Theme",
    icon: "🎨",
    color: "#a855f7",
    startSec: 35,
    durationSec: 10,
  },
  {
    title: "Admin",
    sub: "Plattform-Einstellungen, User-Verwaltung, SMTP",
    icon: "⚙️",
    color: "#ef4444",
    startSec: 45,
    durationSec: 10,
  },
];

function MockWindow({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: BRAND.navyMid,
        borderRadius: 16,
        border: `1px solid rgba(63,228,139,0.15)`,
        overflow: "hidden",
        width: 900,
        boxShadow: "0 32px 64px rgba(0,0,0,0.4)",
      }}
    >
      {/* Titlebar */}
      <div
        style={{
          background: BRAND.navyLight,
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
          <div key={c} style={{ width: 14, height: 14, borderRadius: "50%", background: c }} />
        ))}
        <span style={{ marginLeft: 12, color: BRAND.light, fontSize: 16, opacity: 0.6 }}>{title}</span>
      </div>
      <div style={{ padding: 32 }}>{children}</div>
    </div>
  );
}

function SectionSlide({ section, progress }: { section: (typeof SECTIONS)[0]; progress: number }) {
  const slideIn = interpolate(progress, [0, 0.5], [60, 0], { extrapolateRight: "clamp" });
  const opacity = interpolate(progress, [0, 0.5], [0, 1], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        gap: 40,
        transform: `translateY(${slideIn}px)`,
        opacity,
      }}
    >
      {/* Section label */}
      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 80 }}>{section.icon}</span>
        <h2
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: section.color,
            margin: "12px 0 0",
          }}
        >
          Studio · {section.title}
        </h2>
        <p style={{ fontSize: 32, color: BRAND.light, opacity: 0.7, margin: "8px 0 0" }}>
          {section.sub}
        </p>
      </div>

      <MockWindow title={`play.itsweber.net/studio/${section.title.toLowerCase()}`}>
        {/* Simulated UI rows */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {[0.8, 0.6, 0.5, 0.4].map((w, i) => (
            <div
              key={i}
              style={{
                height: 20,
                width: `${w * 100}%`,
                borderRadius: 6,
                background: i === 0 ? section.color : `rgba(255,255,255,0.08)`,
              }}
            />
          ))}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <div
              style={{
                padding: "10px 28px",
                background: section.color,
                borderRadius: 8,
                color: BRAND.navy,
                fontSize: 18,
                fontWeight: 700,
              }}
            >
              Speichern
            </div>
            <div
              style={{
                padding: "10px 28px",
                background: "rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: BRAND.light,
                fontSize: 18,
              }}
            >
              Abbrechen
            </div>
          </div>
        </div>
      </MockWindow>
    </AbsoluteFill>
  );
}

export const StudioTourLong: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const introProgress = spring({ frame, fps, config: { damping: 12 } });
  const introOpacity = interpolate(frame, [fps * 4, fps * 5], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  // Outro fade (55–60s)
  const outroOpacity = interpolate(frame, [fps * 55, fps * 58], [0, 1], {
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
      {/* Background gradient */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(ellipse at 20% 50%, rgba(63,228,139,0.06) 0%, transparent 60%)`,
        }}
      />

      {/* Intro (0–5s) */}
      <Sequence from={0} durationInFrames={fps * 5}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 24,
            opacity: introOpacity,
            transform: `scale(${interpolate(introProgress, [0, 1], [0.85, 1])})`,
          }}
        >
          <h1 style={{ fontSize: 88, fontWeight: 800, color: BRAND.white, margin: 0, textAlign: "center" }}>
            Das <span style={{ color: BRAND.green }}>Studio</span>
          </h1>
          <p style={{ fontSize: 36, color: BRAND.light, opacity: 0.7, margin: 0 }}>
            In 60 Sekunden erklärt
          </p>
        </AbsoluteFill>
      </Sequence>

      {/* Section slides */}
      {SECTIONS.map((section) => {
        const startF = fps * section.startSec;
        const dur = fps * section.durationSec;
        const progress = interpolate(frame, [startF, startF + fps * 1.2], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <Sequence key={section.title} from={startF} durationInFrames={dur}>
            <SectionSlide section={section} progress={progress} />
          </Sequence>
        );
      })}

      {/* Outro (55–60s) */}
      <Sequence from={fps * 55} durationInFrames={fps * 5}>
        <AbsoluteFill
          style={{
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            gap: 24,
            opacity: outroOpacity,
          }}
        >
          <h2 style={{ fontSize: 72, fontWeight: 800, color: BRAND.white, margin: 0, textAlign: "center" }}>
            Bereit zum Loslegen?
          </h2>
          <p style={{ fontSize: 32, color: BRAND.green, margin: 0 }}>
            play.itsweber.net/studio
          </p>
        </AbsoluteFill>
      </Sequence>
    </AbsoluteFill>
  );
};
