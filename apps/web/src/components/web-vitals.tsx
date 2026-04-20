"use client";

// Reports Core-Web-Vitals (LCP, CLS, INP, FCP, TTFB) nach /api/analytics/web-
// vitals. Rate-limited vom API via Fastify-Rate-Limit. Schweigend bei Fehler.

import { useReportWebVitals } from "next/web-vitals";

export function WebVitalsReporter() {
  useReportWebVitals((metric) => {
    try {
      const body = JSON.stringify({
        name: metric.name,
        value: metric.value,
        rating: metric.rating,
        id: metric.id,
        path: typeof window !== "undefined" ? window.location.pathname : "",
      });
      const url = "/api/analytics/web-vitals";
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        void fetch(url, {
          method: "POST",
          body,
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        }).catch(() => null);
      }
    } catch {
      // silent
    }
  });
  return null;
}
