import { router } from "../init";
import { healthRouter } from "./health";
import { authRouter } from "./auth";
import { videoRouter } from "./video";
import { channelRouter } from "./channel";
import { adminRouter } from "./admin";
import { themeRouter } from "./theme";
import { pageRouter } from "./page";
import { studioRouter } from "./studio";
import { categoryRouter } from "./category";
import { subscriptionRouter } from "./subscription";
import { searchRouter } from "./search";
import { commentRouter } from "./comment";
import { reactionRouter } from "./reaction";
import { reportRouter } from "./report";
import { notificationRouter } from "./notification";
import { staticPageRouter } from "./static-page";
import { historyRouter } from "./history";
import { watchLaterRouter } from "./watch-later";
import { siteSettingsRouter } from "./siteSettings";
import { userSettingsRouter } from "./userSettings";
import { playlistRouter } from "./playlist";
import { userRouter } from "./user";
import { communityRouter } from "./community";
import { dmRouter } from "./dm";
import { setupRouter } from "./setup";

export const appRouter = router({
  health: healthRouter,
  auth: authRouter,
  video: videoRouter,
  channel: channelRouter,
  admin: adminRouter,
  theme: themeRouter,
  page: pageRouter,
  staticPage: staticPageRouter,
  studio: studioRouter,
  category: categoryRouter,
  subscription: subscriptionRouter,
  search: searchRouter,
  comment: commentRouter,
  reaction: reactionRouter,
  report: reportRouter,
  notification: notificationRouter,
  history: historyRouter,
  watchLater: watchLaterRouter,
  siteSettings: siteSettingsRouter,
  userSettings: userSettingsRouter,
  playlist: playlistRouter,
  user: userRouter,
  community: communityRouter,
  dm: dmRouter,
  setup: setupRouter,
});

export type AppRouter = typeof appRouter;
