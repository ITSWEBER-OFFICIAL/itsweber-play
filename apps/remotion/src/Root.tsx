import { Composition } from "remotion";
import { WelcomeLong } from "./compositions/WelcomeLong";
import { StudioTourLong } from "./compositions/StudioTourLong";
import { ShortsFeatureShort } from "./compositions/ShortsFeatureShort";
import { AccessibilityShort } from "./compositions/AccessibilityShort";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* 90 s · 1920×1080 · 30 fps */}
      <Composition
        id="WelcomeLong"
        component={WelcomeLong}
        durationInFrames={2700}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* 60 s · 1920×1080 · 30 fps */}
      <Composition
        id="StudioTourLong"
        component={StudioTourLong}
        durationInFrames={1800}
        fps={30}
        width={1920}
        height={1080}
      />
      {/* 15 s · 1080×1920 · 60 fps */}
      <Composition
        id="ShortsFeatureShort"
        component={ShortsFeatureShort}
        durationInFrames={900}
        fps={60}
        width={1080}
        height={1920}
      />
      {/* 20 s · 1080×1920 · 60 fps */}
      <Composition
        id="AccessibilityShort"
        component={AccessibilityShort}
        durationInFrames={1200}
        fps={60}
        width={1080}
        height={1920}
      />
    </>
  );
};
