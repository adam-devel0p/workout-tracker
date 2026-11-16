CREATE TABLE "exercise" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workout" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workout_date_unique" UNIQUE("date")
);
--> statement-breakpoint
CREATE TABLE "workout_exercise" (
	"id" serial PRIMARY KEY NOT NULL,
	"workout_id" integer NOT NULL,
	"exercise_id" integer NOT NULL,
	"position" integer NOT NULL,
	CONSTRAINT "workout_exercise_workout_id_exercise_id_unique" UNIQUE("workout_id","exercise_id")
);
--> statement-breakpoint
CREATE TABLE "workout_set" (
	"id" serial PRIMARY KEY NOT NULL,
	"workout_exercise_id" integer NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer NOT NULL,
	"weight_kg" numeric(6, 2),
	CONSTRAINT "workout_set_workout_exercise_id_set_number_unique" UNIQUE("workout_exercise_id","set_number"),
	CONSTRAINT "workout_set_set_number_check" CHECK ("workout_set"."set_number" > 0),
	CONSTRAINT "workout_set_reps_check" CHECK ("workout_set"."reps" > 0),
	CONSTRAINT "workout_set_weight_kg_check" CHECK ("workout_set"."weight_kg" >= 0)
);
--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_workout_id_workout_id_fk" FOREIGN KEY ("workout_id") REFERENCES "public"."workout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_exercise" ADD CONSTRAINT "workout_exercise_exercise_id_exercise_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercise"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workout_set" ADD CONSTRAINT "workout_set_workout_exercise_id_workout_exercise_id_fk" FOREIGN KEY ("workout_exercise_id") REFERENCES "public"."workout_exercise"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "exercise_name_unique" ON "exercise" USING btree (lower("name"));