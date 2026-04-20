-- Deploy-Hardening: Composite-Indizes auf Subscription.
--
-- 1) (channelId, notify)  → beschleunigt die Notification-Lookup-Query beim
--    Transcode-Finalize: `WHERE channelId=? AND notify=true`. Ohne diesen Index
--    scannt Postgres bei jeder Publikation den vollen channelId-Bucket.
-- 2) (subscriberId, createdAt)  → deckt den `/subs`-Feed ab (neueste Abos zuerst).
--    Mit dem existierenden PK [subscriberId, channelId] allein müsste Postgres
--    für Ordering nach createdAt einen Extra-Sort laufen.

CREATE INDEX "Subscription_channelId_notify_idx"
  ON "Subscription"("channelId", "notify");

CREATE INDEX "Subscription_subscriberId_createdAt_idx"
  ON "Subscription"("subscriberId", "createdAt");
