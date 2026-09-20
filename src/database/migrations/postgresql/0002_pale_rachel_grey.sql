ALTER TABLE "item_mappings" ALTER COLUMN "common_item" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "item_mappings" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "item_mappings" ALTER COLUMN "status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ibas_offices" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;