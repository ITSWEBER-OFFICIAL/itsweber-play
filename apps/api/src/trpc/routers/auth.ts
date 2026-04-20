import { router, publicProcedure } from "../init";

export const authRouter = router({
  // Client ruft das beim Laden auf, um den Viewer-State zu hydratisieren.
  // Gibt null zurück, wenn kein Session-Cookie / abgelaufen.
  session: publicProcedure.query(({ ctx }) => ctx.session ?? null),
});
