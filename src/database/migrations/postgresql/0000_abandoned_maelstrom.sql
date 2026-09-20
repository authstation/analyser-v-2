CREATE TABLE "roles" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "roles_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer,
	"jti" varchar(191) NOT NULL,
	"revoked" boolean DEFAULT false,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_jti_unique" UNIQUE("jti")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"password" text NOT NULL,
	"role_id" integer,
	"email_verified_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "bin_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"bin" text,
	"entity_name" text,
	"bin_issue_date" timestamp,
	"bin_status" text DEFAULT 'Active',
	"forced_registration" text,
	"major_area" text,
	"manufacturing_area" text,
	"service_area" text,
	"email" text,
	"mobile" text,
	"address" text,
	"circle_id" integer,
	"division_id" integer,
	"police_station_id" integer,
	"e_tin" text,
	"raw_json" text,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bin_data_bin_unique" UNIQUE("bin")
);
--> statement-breakpoint
CREATE TABLE "column_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"module" text DEFAULT 'bin_analyser' NOT NULL,
	"excel_header" text NOT NULL,
	"db_column" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "return_data" (
	"id" serial PRIMARY KEY NOT NULL,
	"division_id" integer,
	"circle_id" integer,
	"bin" text NOT NULL,
	"submission_id" text,
	"tax_period" timestamp,
	"has_activities" text,
	"total_sales_value" numeric(20, 2),
	"total_payable_vat" numeric(20, 2),
	"total_payable_sd" numeric(20, 2),
	"total_input_tax_credit_value" numeric(20, 2),
	"total_input_tax_credit_vat" numeric(20, 2),
	"increasing_adjustment" numeric(20, 2),
	"decreasing_adjustment" numeric(20, 2),
	"net_payable_vat" numeric(20, 2),
	"net_payable_sd" numeric(20, 2),
	"fine_penalty" numeric(20, 2),
	"deposited_vat" numeric(20, 2),
	"deposited_sd" numeric(20, 2),
	"closing_balance_vat" numeric(20, 2),
	"closing_balance_sd" numeric(20, 2),
	"vds_increasing" numeric(20, 2),
	"vds_decreasing" numeric(20, 2),
	"advanced_tax_paid" numeric(20, 2),
	"submission_date" text,
	"last_amendment_date" text,
	"raw_json" text,
	"uploaded_by" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "app_settings_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "circles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"division_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "circles_name_division_id_unique" UNIQUE("name","division_id")
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "divisions_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "ibas_offices" (
	"id" serial PRIMARY KEY NOT NULL,
	"office_name" text NOT NULL,
	"area_name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "item_mappings" (
	"id" serial PRIMARY KEY NOT NULL,
	"module_name" text NOT NULL,
	"item_name" text NOT NULL,
	"common_item" text NOT NULL,
	"status" text DEFAULT 'approved' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "police_stations" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"circle_id" integer NOT NULL,
	"division_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "police_stations_name_circle_id_unique" UNIQUE("name","circle_id")
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"circle_id" integer NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "bin_data" ADD CONSTRAINT "bin_data_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bin_data" ADD CONSTRAINT "bin_data_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bin_data" ADD CONSTRAINT "bin_data_police_station_id_police_stations_id_fk" FOREIGN KEY ("police_station_id") REFERENCES "public"."police_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bin_data" ADD CONSTRAINT "bin_data_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_data" ADD CONSTRAINT "return_data_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_data" ADD CONSTRAINT "return_data_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "return_data" ADD CONSTRAINT "return_data_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circles" ADD CONSTRAINT "circles_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "police_stations" ADD CONSTRAINT "police_stations_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "police_stations" ADD CONSTRAINT "police_stations_division_id_divisions_id_fk" FOREIGN KEY ("division_id") REFERENCES "public"."divisions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bin_data_circle_id_idx" ON "bin_data" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "bin_data_police_station_id_idx" ON "bin_data" USING btree ("police_station_id");--> statement-breakpoint
CREATE INDEX "bin_data_division_id_idx" ON "bin_data" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "bin_data_bin_status_idx" ON "bin_data" USING btree ("bin_status");--> statement-breakpoint
CREATE INDEX "bin_data_forced_reg_idx" ON "bin_data" USING btree ("forced_registration");--> statement-breakpoint
CREATE INDEX "bin_data_major_area_idx" ON "bin_data" USING btree ("major_area");--> statement-breakpoint
CREATE INDEX "bin_data_bin_issue_date_idx" ON "bin_data" USING btree ("bin_issue_date");--> statement-breakpoint
CREATE INDEX "return_data_bin_idx" ON "return_data" USING btree ("bin");--> statement-breakpoint
CREATE INDEX "return_data_circle_id_idx" ON "return_data" USING btree ("circle_id");--> statement-breakpoint
CREATE INDEX "return_data_division_id_idx" ON "return_data" USING btree ("division_id");--> statement-breakpoint
CREATE INDEX "return_data_tax_period_idx" ON "return_data" USING btree ("tax_period");--> statement-breakpoint
CREATE INDEX "return_data_has_activities_idx" ON "return_data" USING btree ("has_activities");--> statement-breakpoint
CREATE INDEX "subscriptions_user_circle_status_idx" ON "subscriptions" USING btree ("user_id","circle_id","status");