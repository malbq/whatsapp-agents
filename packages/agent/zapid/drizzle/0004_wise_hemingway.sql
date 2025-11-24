ALTER TABLE "snippet" ADD COLUMN "fts" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', "snippet"."content")) STORED NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_snippet_fts" ON "snippet" USING gin ("fts");--> statement-breakpoint
CREATE INDEX "idx_snippet_vector" ON "snippet" USING hnsw ("vector" vector_cosine_ops);