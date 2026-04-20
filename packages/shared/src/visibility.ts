// Single source of truth für die Sichtbarkeits-Prüfung.
// Jeder Video-Read-Pfad (Detail-Route, HLS-Signed-URL, List-Filter) ruft diese
// Funktion — damit Verstöße gegen das Sichtbarkeitsmodell nicht durch neue
// Endpoints reinrutschen können.
//
// Enum-Werte sind die Prisma-Enum-Strings 1:1 — kein Mapping nötig zwischen
// DB-Layer und dieser Lib.

export const VISIBILITIES = [
  "PUBLIC",
  "UNLISTED",
  "PRIVATE",
  "LOGGED_IN",
] as const;
export type Visibility = (typeof VISIBILITIES)[number];

export const ROLES = ["ADMIN", "MODERATOR", "CREATOR", "VIEWER"] as const;
export type Role = (typeof ROLES)[number];

/** Strukturell minimaler Video-Shape für die Sichtbarkeitsprüfung. */
export interface VisibilityVideo {
  visibility: Visibility;
  ownerId: string;
}

/** Strukturell minimaler Viewer-Shape — `null` = nicht eingeloggt. */
export interface VisibilityViewer {
  id: string;
  role: Role;
}

/**
 * Darf `viewer` dieses `video` sehen?
 *
 * - PUBLIC / UNLISTED: ja (UNLISTED ist in Listen unsichtbar, aber per Direkt-ID abrufbar)
 * - LOGGED_IN: nur mit Session
 * - PRIVATE: nur Owner oder ADMIN
 */
export function canViewVideo(
  video: VisibilityVideo,
  viewer: VisibilityViewer | null,
): boolean {
  switch (video.visibility) {
    case "PUBLIC":
    case "UNLISTED":
      return true;
    case "LOGGED_IN":
      return viewer !== null;
    case "PRIVATE":
      return (
        viewer !== null &&
        (viewer.id === video.ownerId || viewer.role === "ADMIN")
      );
  }
}

/**
 * Darf das Video in öffentlichen Listen (Startseite, Suche) auftauchen?
 * UNLISTED + PRIVATE werden ausgefiltert — die Owner-eigene Liste im Studio
 * benutzt diesen Filter bewusst NICHT.
 */
export function isListableForEveryone(visibility: Visibility): boolean {
  return visibility === "PUBLIC";
}

/**
 * Darf `viewer` das Video in SEINEN eigenen Listen (Studio, Playlists) sehen?
 * Owner sieht alles eigenes, ADMIN sieht alles.
 */
export function canListForViewer(
  video: VisibilityVideo,
  viewer: VisibilityViewer | null,
): boolean {
  if (isListableForEveryone(video.visibility)) return true;
  if (viewer === null) return false;
  if (viewer.role === "ADMIN") return true;
  return viewer.id === video.ownerId;
}
