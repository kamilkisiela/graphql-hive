import {
  buildSchema,
  GraphQLFieldMap,
  GraphQLSchema,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isIntrospectionType,
  isObjectType,
  isScalarType,
  isUnionType,
} from 'graphql';
import { sql, type CommonQueryMethods } from 'slonik';
import { env } from '../environment';
import type { MigrationExecutor } from '../pg-migrator';

export default {
  name: '2024.07.23T09.36.00.schema-cleanup-tracker.ts',
  async run({ connection }) {
    await connection.query(sql`
      CREATE TABLE IF NOT EXISTS "schema_coordinate_status" (
        coordinate text NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        created_in_version_id UUID NOT NULL REFERENCES "schema_versions" ("id") ON DELETE CASCADE,
        deprecated_at TIMESTAMPTZ,
        deprecated_in_version_id UUID REFERENCES "schema_versions" ("id") ON DELETE CASCADE,
        "target_id" UUID NOT NULL REFERENCES "targets" ("id") ON DELETE CASCADE,
        PRIMARY KEY (coordinate, target_id)
      );
    
      CREATE INDEX IF NOT EXISTS idx_schema_coordinate_status_by_target_timestamp
      ON schema_coordinate_status(
        target_id,
        created_at,
        deprecated_at
      );
      CREATE INDEX IF NOT EXISTS idx_schema_coordinate_status_by_target_coordinate_timestamp
      ON schema_coordinate_status(
        target_id,
        coordinate,
        created_at,
        deprecated_at
      );  
    `);

    if (env.isHiveCloud) {
      console.log('Skipping schema coordinate status migration for hive cloud');
      return;
    }

    const schemaVersionsTotal = await connection.oneFirst<number>(sql`
      SELECT count(*) as total FROM schema_versions
    `);
    console.log(`Found ${schemaVersionsTotal} schema versions`);

    if (schemaVersionsTotal > 1000) {
      console.warn(
        `[WARN] There are more than 1000 schema versions (${schemaVersionsTotal}). Skipping a data backfill.`,
      );
      return;
    }

    await schemaCoordinateStatusMigration(connection);
  },
} satisfies MigrationExecutor;

type SchemaCoordinatesDiffResult = {
  /**
   * Coordinates that are in incoming but not in existing (including deprecated ones)
   */
  added: Set<string>;
  /**
   * Coordinates that are deprecated in incoming, but were not deprecated in existing or non-existent
   */
  deprecated: Set<string>;
};

function diffSchemaCoordinates(
  existingSchema: GraphQLSchema,
  incomingSchema: GraphQLSchema,
): SchemaCoordinatesDiffResult {
  const before = getSchemaCoordinates(existingSchema);
  const after = getSchemaCoordinates(incomingSchema);

  const added = after.coordinates.difference(before.coordinates);
  const deprecated = after.deprecated.difference(before.deprecated);

  return {
    added,
    deprecated,
  };
}

export async function schemaCoordinateStatusMigration(connection: CommonQueryMethods) {
  // Fetch targets
  const targetResult = await connection.query<{ id: string }>(sql`
    SELECT id FROM targets WHERE ID NOT IN (SELECT target_id FROM schema_coordinate_status)
  `);

  console.log(`Found ${targetResult.rowCount} targets`);

  let i = 0;
  for await (const target of targetResult.rows) {
    try {
      console.log(`Processing target (${i++}/${targetResult.rowCount}) - ${target.id}`);

      const latestSchema = await connection.maybeOne<{
        id: string;
        created_at: number;
        is_composable: boolean;
        sdl?: string;
        previous_schema_version_id?: string;
      }>(sql`
      SELECT
        id,
        created_at,
        is_composable,
        previous_schema_version_id,
        composite_schema_sdl as sdl
      FROM schema_versions
      WHERE target_id = ${target.id} AND is_composable = true
      ORDER BY created_at DESC
      LIMIT 1
    `);

      if (!latestSchema) {
        console.log('[SKIPPING] No latest composable schema found for target %s', target.id);
        continue;
      }

      if (!latestSchema.sdl) {
        console.warn(
          `[SKIPPING] No latest, composable schema with non-empty sdl found for target ${target.id}.`,
        );
        continue;
      }

      const schema = buildSchema(latestSchema.sdl, {
        assumeValid: true,
        assumeValidSDL: true,
      });
      const targetCoordinates = getSchemaCoordinates(schema);

      // The idea here is to
      // 1. start from the latest composable version.
      // 2. create a list of coordinates that are in the latest version, all and deprecated.
      // 3. navigate to the previous version and compare the coordinates.
      // 4. if a coordinate is added, upsert it into the schema_coordinate_status and remove it from the list.
      // 5. if a coordinate is deprecated, upsert it into the schema_coordinate_status and remove it from the list of deprecated coordinates.
      // 6. if the list of coordinates is empty, stop the process.
      // 7. if the previous version is not composable, skip it and continue with the next previous version.
      // 8. if the previous version is not found, insert all remaining coordinates and stop the process. This step might create incorrect dates!
      await processVersion(1, connection, targetCoordinates, target.id, {
        schema,
        versionId: latestSchema.id,
        createdAt: latestSchema.created_at,
        previousVersionId: latestSchema.previous_schema_version_id ?? null,
      });
    } catch (error) {
      console.error(`Error processing target ${target.id}`);
      console.error(error);
    }
  }
}

function getSchemaCoordinates(schema: GraphQLSchema): {
  coordinates: Set<string>;
  deprecated: Set<string>;
} {
  const coordinates = new Set<string>();
  const deprecated = new Set<string>();

  const typeMap = schema.getTypeMap();

  for (const typeName in typeMap) {
    const typeDefinition = typeMap[typeName];

    if (isIntrospectionType(typeDefinition)) {
      continue;
    }

    coordinates.add(typeName);

    if (isObjectType(typeDefinition) || isInterfaceType(typeDefinition)) {
      visitSchemaCoordinatesOfGraphQLFieldMap(
        typeName,
        typeDefinition.getFields(),
        coordinates,
        deprecated,
      );
    } else if (isInputObjectType(typeDefinition)) {
      const fieldMap = typeDefinition.getFields();
      for (const fieldName in fieldMap) {
        const fieldDefinition = fieldMap[fieldName];

        coordinates.add(`${typeName}.${fieldName}`);
        if (fieldDefinition.deprecationReason) {
          deprecated.add(`${typeName}.${fieldName}`);
        }
      }
    } else if (isUnionType(typeDefinition)) {
      for (const member of typeDefinition.getTypes()) {
        coordinates.add(`${typeName}.${member.name}`);
      }
    } else if (isEnumType(typeDefinition)) {
      const values = typeDefinition.getValues();
      for (const value of values) {
        coordinates.add(`${typeName}.${value.name}`);
        if (value.deprecationReason) {
          deprecated.add(`${typeName}.${value.name}`);
        }
      }
    } else if (isScalarType(typeDefinition)) {
      //
    } else {
      throw new Error(`Unsupported type kind ${typeName}`);
    }
  }

  return {
    coordinates,
    deprecated,
  };
}

function visitSchemaCoordinatesOfGraphQLFieldMap(
  typeName: string,
  fieldMap: GraphQLFieldMap<any, any>,
  coordinates: Set<string>,
  deprecated: Set<string>,
) {
  for (const fieldName in fieldMap) {
    const fieldDefinition = fieldMap[fieldName];

    coordinates.add(`${typeName}.${fieldName}`);
    if (fieldDefinition.deprecationReason) {
      deprecated.add(`${typeName}.${fieldName}`);
    }

    for (const arg of fieldDefinition.args) {
      coordinates.add(`${typeName}.${fieldName}.${arg.name}`);
      if (arg.deprecationReason) {
        deprecated.add(`${typeName}.${fieldName}.${arg.name}`);
      }
    }
  }
}

async function insertRemainingCoordinates(
  connection: CommonQueryMethods,
  targetId: string,
  targetCoordinates: {
    coordinates: Set<string>;
    deprecated: Set<string>;
  },
  versionId: string,
  createdAt: number,
) {
  if (targetCoordinates.coordinates.size === 0) {
    return;
  }

  const pgDate = new Date(createdAt).toISOString();

  // Deprecated only the coordinates that are still in the queue
  const remainingDeprecated = targetCoordinates.deprecated.intersection(
    targetCoordinates.coordinates,
  );

  console.log(
    `Adding remaining ${targetCoordinates.coordinates.size} coordinates for target ${targetId}`,
  );
  await connection.query(sql`
      INSERT INTO schema_coordinate_status
      ( target_id, coordinate, created_at, created_in_version_id )
      SELECT * FROM ${sql.unnest(
        Array.from(targetCoordinates.coordinates).map(coordinate => [
          targetId,
          coordinate,
          pgDate,
          versionId,
        ]),
        ['uuid', 'text', 'date', 'uuid'],
      )}
      ON CONFLICT (target_id, coordinate)
      DO UPDATE SET created_at = ${pgDate}, created_in_version_id = ${versionId}
    `);

  if (remainingDeprecated.size) {
    console.log(
      `Deprecating remaining ${remainingDeprecated.size} coordinates for target ${targetId}`,
    );
    await connection.query(sql`
      INSERT INTO schema_coordinate_status
      ( target_id, coordinate, created_at, created_in_version_id, deprecated_at, deprecated_in_version_id )
      SELECT * FROM ${sql.unnest(
        Array.from(remainingDeprecated).map(coordinate => [
          targetId,
          coordinate,
          pgDate,
          versionId,
          pgDate,
          versionId,
        ]),
        ['uuid', 'text', 'date', 'uuid', 'date', 'uuid'],
      )}
      ON CONFLICT (target_id, coordinate)
      DO UPDATE SET deprecated_at = ${pgDate}, deprecated_in_version_id = ${versionId}
    `);
    // there will be a conflict, because we are going from deprecated to added order.
  }
}

async function processVersion(
  depth: number,
  connection: CommonQueryMethods,
  targetCoordinates: {
    coordinates: Set<string>;
    deprecated: Set<string>;
  },
  targetId: string,
  after: {
    schema: GraphQLSchema;
    versionId: string;
    createdAt: number;
    previousVersionId: string | null;
  },
): Promise<void> {
  console.log(`Processing target %s at depth %s - version`, targetId, depth, after.versionId);
  const previousVersionId = after.previousVersionId;
  if (!previousVersionId) {
    // Seems like there is no previous version.
    console.log(
      `[END] No previous version found. Inserting all remaining coordinates for ${targetId}`,
    );
    await insertRemainingCoordinates(
      connection,
      targetId,
      targetCoordinates,
      after.versionId,
      after.createdAt,
    );
    return;
  }

  const versionBefore = await connection.maybeOne<{
    id: string;
    sdl?: string;
    previous_schema_version_id?: string;
    created_at: number;
    is_composable: boolean;
  }>(sql`
    SELECT
      id,
      composite_schema_sdl as sdl,
      previous_schema_version_id,
      created_at,
      is_composable
    FROM schema_versions
    WHERE id = ${previousVersionId} AND target_id = ${targetId}
  `);

  if (!versionBefore) {
    console.error(
      `[ERROR] No schema found for version ${previousVersionId}. Inserting all remaining coordinates for ${targetId}`,
    );
    await insertRemainingCoordinates(
      connection,
      targetId,
      targetCoordinates,
      after.versionId,
      after.createdAt,
    );
    return;
  }

  if (!versionBefore.is_composable) {
    // Skip non-composable schemas and continue with the previous version.
    return processVersion(depth + 1, connection, targetCoordinates, targetId, {
      schema: after.schema,
      versionId: after.versionId,
      createdAt: after.createdAt,
      previousVersionId: versionBefore.previous_schema_version_id ?? null,
    });
  }

  if (!versionBefore.sdl) {
    console.error(
      `[ERROR] No SDL found for version ${previousVersionId}. Inserting all remaining coordinates for ${targetId}`,
    );
    await insertRemainingCoordinates(
      connection,
      targetId,
      targetCoordinates,
      after.versionId,
      after.createdAt,
    );
    return;
  }

  const before: {
    schema: GraphQLSchema;
    versionId: string;
    createdAt: number;
    previousVersionId: string | null;
  } = {
    schema: buildSchema(versionBefore.sdl, {
      assumeValid: true,
      assumeValidSDL: true,
    }),
    versionId: versionBefore.id,
    createdAt: versionBefore.created_at,
    previousVersionId: versionBefore.previous_schema_version_id ?? null,
  };
  const diff = diffSchemaCoordinates(before.schema, after.schema);

  // We don't have to track undeprecated or deleted coordinates
  // as we only want to represent the current state of the schema.
  const added: string[] = [];
  const deprecated: string[] = [];
  const deleteAdded = new Set<string>();
  const deleteDeprecated = new Set<string>();

  for (const coordinate of diff.added) {
    if (targetCoordinates.coordinates.has(coordinate)) {
      added.push(coordinate);
      // We found a schema version that added a coordinate, so we don't have to look further
      deleteAdded.add(coordinate);
    }
  }

  for (const coordinate of diff.deprecated) {
    if (targetCoordinates.deprecated.has(coordinate)) {
      deprecated.push(coordinate);
      deleteDeprecated.add(coordinate);
    }
  }

  const datePG = new Date(after.createdAt).toISOString();

  if (added.length) {
    console.log(`Adding ${added.length} coordinates for target ${targetId}`);
    await connection.query(sql`
      INSERT INTO schema_coordinate_status
      ( target_id, coordinate, created_at, created_in_version_id )
      SELECT * FROM ${sql.unnest(
        added.map(coordinate => [targetId, coordinate, datePG, after.versionId]),
        ['uuid', 'text', 'date', 'uuid'],
      )}
      ON CONFLICT (target_id, coordinate)
      DO UPDATE SET created_at = ${datePG}, created_in_version_id = ${after.versionId}
    `);
    // there will be a conflict, because we are going from deprecated to added order.
  }

  if (deprecated.length) {
    console.log(`deprecating ${deprecated.length} coordinates for target ${targetId}`);

    await connection.query(sql`
      INSERT INTO schema_coordinate_status
      ( target_id, coordinate, created_at, created_in_version_id, deprecated_at, deprecated_in_version_id )
      SELECT * FROM ${sql.unnest(
        deprecated.map(coordinate => [
          targetId,
          coordinate,
          datePG,
          after.versionId,
          datePG,
          after.versionId,
        ]),
        ['uuid', 'text', 'date', 'uuid', 'date', 'uuid'],
      )}
      ON CONFLICT (target_id, coordinate)
      DO UPDATE SET deprecated_at = ${datePG}, deprecated_in_version_id = ${after.versionId}
    `);
    // there will be a conflict, because we are going from deprecated to added order.
  }

  // Remove coordinates that were added in this diff.
  // We don't need to look for them in previous versions.
  for (const coordinate of deleteAdded) {
    targetCoordinates.coordinates.delete(coordinate);
  }
  // Remove coordinates that were deprecated in this diff.
  // To avoid marking them as deprecated later on.
  for (const coordinate of deleteDeprecated) {
    targetCoordinates.deprecated.delete(coordinate);
  }

  if (deleteAdded.size) {
    console.log(`Deleted ${deleteAdded.size} coordinates from the stack`);
    console.log(`Coordinates in queue: ${targetCoordinates.coordinates.size}`);
  }

  return processVersion(depth + 1, connection, targetCoordinates, targetId, before);
}
