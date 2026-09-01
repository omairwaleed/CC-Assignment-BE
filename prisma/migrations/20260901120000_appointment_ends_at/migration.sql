-- Replace duration_minutes with an absolute ends_at timestamp.

-- Add the new column as nullable so existing rows can be backfilled.
ALTER TABLE "appointments" ADD COLUMN "ends_at" TIMESTAMP(3);

-- Backfill from the old duration.
UPDATE "appointments"
SET "ends_at" = "starts_at" + ("duration_minutes" * INTERVAL '1 minute');

-- Now enforce NOT NULL and drop the old column.
ALTER TABLE "appointments" ALTER COLUMN "ends_at" SET NOT NULL;
ALTER TABLE "appointments" DROP COLUMN "duration_minutes";

-- Index supporting the per-doctor overlap check.
CREATE INDEX "appointments_doctor_id_starts_at_ends_at_idx" ON "appointments"("doctor_id", "starts_at", "ends_at");
