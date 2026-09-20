-- Migration: Add updated_at and email_verified_at columns to users table
-- Also adds role enum and updates users table to match current schema

-- Add email_verified_at column (may already exist in some deployments)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp;
--> statement-breakpoint

-- Add updated_at column (was missing from schema, referenced in code)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now() NOT NULL;
--> statement-breakpoint

-- Add role enum type if not exists (for deployments that may not have it)
DO $$ BEGIN
  CREATE TYPE "public"."role" AS ENUM('admin', 'user');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint

-- Add role column using enum if not exists (replaces text role column in older deployments)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" "role" DEFAULT 'user' NOT NULL;
--> statement-breakpoint

-- Add has_changed_circle column if not exists (for older deployments)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "has_changed_circle" boolean DEFAULT false NOT NULL;
--> statement-breakpoint

-- Add plan_start_date column if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_start_date" timestamp;
--> statement-breakpoint

-- Add trx_id column if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "trx_id" text;
--> statement-breakpoint

-- Add payment_status column if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payment_status" text DEFAULT 'none';
--> statement-breakpoint

-- Add plan_id column if not exists
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "plan_id" integer;
