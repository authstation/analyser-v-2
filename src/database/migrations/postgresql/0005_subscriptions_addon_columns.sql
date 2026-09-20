ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "trx_id" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "payment_method" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "is_addon" boolean DEFAULT false NOT NULL;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "addon_price" integer DEFAULT 300 NOT NULL;
