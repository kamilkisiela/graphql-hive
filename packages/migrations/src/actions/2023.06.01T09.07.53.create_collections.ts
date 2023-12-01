import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.06.01T09.07.53.create_collections.sql',
  run: ({ sql }) => sql`
CREATE TABLE "document_collections" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "title" text NOT NULL,
  "description" text,
  "target_id" uuid NOT NULL REFERENCES "targets"("id") ON DELETE CASCADE,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX "document_collections_connection_pagination" ON "document_collections" (
  "target_id" ASC,
  "created_at" DESC,
  "id" DESC
);

CREATE TABLE "document_collection_documents" (
  "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
  "title" text NOT NULL,
  "contents" text NOT NULL,
  "variables" text,
  "headers" text,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "document_collection_id" uuid NOT NULL REFERENCES "document_collections"("id") ON DELETE CASCADE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("id")
);

CREATE INDEX "document_collection_documents_connection_pagination" ON "document_collection_documents" (
  "document_collection_id" ASC,
  "created_at" DESC,
  "id" DESC
);
`,
} satisfies MigrationExecutor;
