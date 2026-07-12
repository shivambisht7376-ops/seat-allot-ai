-- Migration: 0002_add_user_fields_and_auth
-- Run AFTER 0001_init. Adds user profile/auth fields,
-- project color, unique seat label index, and allocation_logs table.

-- Users: add profile + auth columns
ALTER TABLE "users" ADD COLUMN "jobTitle"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "department"   TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "status"       TEXT NOT NULL DEFAULT 'Active';
ALTER TABLE "users" ADD COLUMN "joinDate"     TEXT NOT NULL DEFAULT '';
ALTER TABLE "users" ADD COLUMN "passwordHash" TEXT;
ALTER TABLE "users" ADD COLUMN "lastLoginAt"  TIMESTAMP(3);
CREATE INDEX "users_tenantId_status_idx" ON "users"("tenantId", "status");

-- Projects: add UI color
ALTER TABLE "projects" ADD COLUMN "color" TEXT NOT NULL DEFAULT '#3b82f6';

-- Seats: rename row->number, drop col; add label unique index
-- (0001 created row/col columns; we replace with number)
ALTER TABLE "seats" RENAME COLUMN "row" TO "number";
ALTER TABLE "seats" DROP COLUMN IF EXISTS "col";
DROP INDEX IF EXISTS "seats_tenantId_floor_zone_row_col_key";
CREATE UNIQUE INDEX "seats_tenantId_label_key"          ON "seats"("tenantId", "label");
CREATE UNIQUE INDEX "seats_tenantId_floor_zone_number_key" ON "seats"("tenantId", "floor", "zone", "number");

-- Allocation logs table
CREATE TABLE "allocation_logs" (
  "id"            TEXT         NOT NULL,
  "tenantId"      TEXT         NOT NULL,
  "employeeCode"  TEXT         NOT NULL,
  "employeeName"  TEXT         NOT NULL,
  "action"        TEXT         NOT NULL,
  "seatLabel"     TEXT,
  "prevSeatLabel" TEXT,
  "details"       TEXT         NOT NULL,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "allocation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "allocation_logs_tenantId_idx"   ON "allocation_logs"("tenantId");
CREATE INDEX "allocation_logs_createdAt_idx"  ON "allocation_logs"("createdAt" DESC);

ALTER TABLE "allocation_logs"
  ADD CONSTRAINT "allocation_logs_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
