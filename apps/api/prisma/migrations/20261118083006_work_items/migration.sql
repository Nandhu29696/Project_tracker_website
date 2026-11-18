-- CreateEnum
CREATE TYPE "WorkItemType" AS ENUM ('EPIC', 'FEATURE', 'STORY', 'BUG', 'TASK');

-- CreateEnum
CREATE TYPE "WorkItemState" AS ENUM ('NEW', 'TRIAGED', 'TODO', 'ACTIVE', 'IN_PROGRESS', 'RESOLVED', 'VERIFIED', 'DONE', 'CLOSED', 'REMOVED');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('S1_CRITICAL', 'S2_HIGH', 'S3_MEDIUM', 'S4_LOW');

-- CreateEnum
CREATE TYPE "Resolution" AS ENUM ('FIXED', 'WONT_FIX', 'DUPLICATE', 'CANNOT_REPRODUCE', 'BY_DESIGN');

-- CreateEnum
CREATE TYPE "LinkType" AS ENUM ('RELATES', 'BLOCKS', 'DUPLICATES');

-- CreateTable
CREATE TABLE "work_items" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "number" INTEGER NOT NULL,
    "type" "WorkItemType" NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "state" "WorkItemState" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "severity" "Severity",
    "resolution" "Resolution",
    "story_points" DOUBLE PRECISION,
    "original_estimate" DOUBLE PRECISION,
    "remaining_work" DOUBLE PRECISION,
    "completed_work" DOUBLE PRECISION,
    "start_date" DATE,
    "due_date" DATE,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "environment" "EnvironmentType",
    "repro_steps" TEXT,
    "expected_result" TEXT,
    "actual_result" TEXT,
    "assignee_id" UUID,
    "created_by_id" UUID,
    "parent_id" UUID,
    "rank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "state_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "work_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item_links" (
    "id" UUID NOT NULL,
    "source_id" UUID NOT NULL,
    "target_id" UUID NOT NULL,
    "type" "LinkType" NOT NULL,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_item_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "work_item_id" UUID NOT NULL,
    "author_id" UUID,
    "body" TEXT NOT NULL,
    "mentions" UUID[] DEFAULT ARRAY[]::UUID[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "edited_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attachments" (
    "id" UUID NOT NULL,
    "work_item_id" UUID NOT NULL,
    "uploaded_by_id" UUID,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "size" INTEGER NOT NULL,
    "storage_key" VARCHAR(100) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_item_history" (
    "id" UUID NOT NULL,
    "work_item_id" UUID NOT NULL,
    "actor_id" UUID,
    "field" VARCHAR(50) NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_item_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saved_queries" (
    "id" UUID NOT NULL,
    "owner_id" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "filters" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_queries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "work_items_project_id_state_idx" ON "work_items"("project_id", "state");

-- CreateIndex
CREATE INDEX "work_items_assignee_id_state_idx" ON "work_items"("assignee_id", "state");

-- CreateIndex
CREATE INDEX "work_items_parent_id_idx" ON "work_items"("parent_id");

-- CreateIndex
CREATE INDEX "work_items_type_idx" ON "work_items"("type");

-- CreateIndex
CREATE INDEX "work_items_tags_idx" ON "work_items" USING GIN ("tags");

-- CreateIndex
CREATE UNIQUE INDEX "work_items_project_id_number_key" ON "work_items"("project_id", "number");

-- CreateIndex
CREATE INDEX "work_item_links_target_id_idx" ON "work_item_links"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "work_item_links_source_id_target_id_type_key" ON "work_item_links"("source_id", "target_id", "type");

-- CreateIndex
CREATE INDEX "comments_work_item_id_created_at_idx" ON "comments"("work_item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");

-- CreateIndex
CREATE INDEX "attachments_work_item_id_idx" ON "attachments"("work_item_id");

-- CreateIndex
CREATE INDEX "work_item_history_work_item_id_created_at_idx" ON "work_item_history"("work_item_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "saved_queries_owner_id_name_key" ON "saved_queries"("owner_id", "name");

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "work_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_links" ADD CONSTRAINT "work_item_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_links" ADD CONSTRAINT "work_item_links_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_links" ADD CONSTRAINT "work_item_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_history" ADD CONSTRAINT "work_item_history_work_item_id_fkey" FOREIGN KEY ("work_item_id") REFERENCES "work_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_item_history" ADD CONSTRAINT "work_item_history_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_queries" ADD CONSTRAINT "saved_queries_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
