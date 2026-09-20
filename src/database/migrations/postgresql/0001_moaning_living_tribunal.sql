CREATE TABLE "penalty_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"amount" integer NOT NULL,
	"effective_date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "item_mappings" ALTER COLUMN "common_item" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "item_mappings" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "item_mappings" ALTER COLUMN "status" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "ibas_offices" DROP COLUMN "created_at";--> statement-breakpoint
ALTER TABLE "item_mappings" ADD CONSTRAINT "item_mappings_module_name_item_name_unique" UNIQUE("module_name","item_name");