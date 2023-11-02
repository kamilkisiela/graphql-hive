import { type MigrationExecutor } from '../pg-migrator';

export default {
  name: '2023.10.20T11.00.00.persisted-documents.ts',
  run: ({ sql }) => sql`
    SELECT 'Enable btree GIN extension';
    CREATE EXTENSION btree_gin;

    CREATE TABLE "persisted_document_deployments" (
      "id" uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4()
      , "target_id" uuid NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE
      , "client_name" text NOT NULL
      , "client_version" text NOT NULL
      , "status" text NOT NULL
      , "created_at" timestamptz NOT NULL DEFAULT now()
    );

    SELECT 'Unique index for persisted document deployments name and version';
    CREATE UNIQUE INDEX "persisted_document_deployments_unique_client_name_version" ON "persisted_document_deployments" (
      "target_id" ASC,
      "client_name" ASC,
      "client_version" ASC
    );

    CREATE TABLE "persisted_documents" (
      "id" uuid PRIMARY KEY NOT NULL DEFAULT uuid_generate_v4()
      , "target_id" uuid NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE
      , "persisted_document_deployment_id" uuid REFERENCES "persisted_document_deployments"("id") ON DELETE CASCADE
      , "hash" text NOT NULL
      , "operation_document" text NOT NULL
      , "document_s3_location" text NOT NULL
      , "schema_coordinates" text[] NOT NULL
      , "operation_names" text[] NOT NULL
      , "is_active" boolean NOT NULL
      , "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    SELECT 'Unique hash index for persisted documents with same persisted document deployment id';
    CREATE UNIQUE INDEX "persisted_documents_unique_hash" ON "persisted_documents" (
      "persisted_document_deployment_id" ASC,
      "hash" ASC
    );

    SELECT 'UI Pagination';
    CREATE INDEX "persisted_document_deployments_pagination" ON "persisted_document_deployments" (
      "target_id" ASC,
      "created_at" DESC,
      "id" DESC
    );

    SELECT 'UI Pagination';
    CREATE INDEX "persisted_documents_pagination" ON "persisted_documents" (
      "persisted_document_deployment_id" ASC,
      "created_at" DESC,
      "id" DESC
    );

    SELECT 'Check schema coordinates';
    CREATE INDEX "persisted_documents_schema_coordinates" ON "persisted_documents" USING GIN (
      "target_id"
      , "schema_coordinates"
    )
    WHERE
      "is_active" = true
    ;
  `,
} satisfies MigrationExecutor;
