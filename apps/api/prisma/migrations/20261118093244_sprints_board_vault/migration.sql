-- CreateEnum
CREATE TYPE "IterationState" AS ENUM ('PLANNED', 'ACTIVE', 'COMPLETED');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "board_settings" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "work_items" ADD COLUMN     "iteration_id" UUID;

-- CreateTable
CREATE TABLE "iterations" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "goal" TEXT,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "state" "IterationState" NOT NULL DEFAULT 'PLANNED',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "iterations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "iteration_capacity" (
    "iteration_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "hours_per_day" DOUBLE PRECISION NOT NULL,
    "days_off" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "iteration_capacity_pkey" PRIMARY KEY ("iteration_id","user_id")
);

-- CreateTable
CREATE TABLE "iteration_snapshots" (
    "iteration_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "remaining_work" DOUBLE PRECISION NOT NULL,
    "remaining_points" DOUBLE PRECISION NOT NULL,
    "total_points" DOUBLE PRECISION NOT NULL,
    "open_items" INTEGER NOT NULL,

    CONSTRAINT "iteration_snapshots_pkey" PRIMARY KEY ("iteration_id","date")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "label" VARCHAR(100) NOT NULL,
    "username" VARCHAR(200),
    "url" VARCHAR(500),
    "environment" "EnvironmentType",
    "notes" TEXT,
    "secret_ciphertext" TEXT NOT NULL,
    "secret_iv" VARCHAR(32) NOT NULL,
    "secret_tag" VARCHAR(32) NOT NULL,
    "key_version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID,
    "updated_by_id" UUID,
    "last_rotated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_revealed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "iterations_project_id_state_idx" ON "iterations"("project_id", "state");

-- CreateIndex
CREATE INDEX "credentials_project_id_idx" ON "credentials"("project_id");

-- CreateIndex
CREATE INDEX "work_items_iteration_id_idx" ON "work_items"("iteration_id");

-- AddForeignKey
ALTER TABLE "work_items" ADD CONSTRAINT "work_items_iteration_id_fkey" FOREIGN KEY ("iteration_id") REFERENCES "iterations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iterations" ADD CONSTRAINT "iterations_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iteration_capacity" ADD CONSTRAINT "iteration_capacity_iteration_id_fkey" FOREIGN KEY ("iteration_id") REFERENCES "iterations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iteration_capacity" ADD CONSTRAINT "iteration_capacity_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "iteration_snapshots" ADD CONSTRAINT "iteration_snapshots_iteration_id_fkey" FOREIGN KEY ("iteration_id") REFERENCES "iterations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
