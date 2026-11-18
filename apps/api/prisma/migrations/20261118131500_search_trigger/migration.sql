-- Replace the generated search column with a trigger-maintained one.
-- (Prisma cannot model generated columns and would report drift on every migration;
--  a plain column + trigger is invisible to its diffing.)
DROP INDEX IF EXISTS "work_items_search_idx";
ALTER TABLE "work_items" DROP COLUMN IF EXISTS "search_vector";
ALTER TABLE "work_items" ADD COLUMN "search_vector" tsvector;

-- 'simple' config = no language stemming: works for any language and for names / codes.
CREATE OR REPLACE FUNCTION work_items_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW."search_vector" :=
    setweight(to_tsvector('simple', coalesce(NEW."title", '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(NEW."description", '')), 'B');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_items_search_vector_trg
  BEFORE INSERT OR UPDATE OF "title", "description" ON "work_items"
  FOR EACH ROW EXECUTE FUNCTION work_items_search_vector_update();

-- backfill existing rows
UPDATE "work_items" SET "title" = "title";

CREATE INDEX "work_items_search_idx" ON "work_items" USING GIN ("search_vector");
