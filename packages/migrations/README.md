# `@hive/migrations`

Service for creating, managing and running database migrations.

We are using [Slonik Migrator](https://github.com/mmkal/slonik-tools/tree/main/packages/migrator)
under the hood, to generate, manage, track and run migrations.

## Development Workflow

To add new migrations, please follow the instructions below, based on the type of the migration you
need to implement.

Please follow these guidelines:

1. Do not delete previous migration files!
2. Do not change any existing migration code or file name, once it's merged to `main` branch!
3. If you need a change in database or structure, make sure that the `down` migration does the exact
   opposite (usually, in the reversed order).
4. Migrations should not take too long to run - if your migration is doing too many things, please
   consider to break it to smaller pieces, or rethink your implemenation.
5. **Remember**: the database in production always contains more data: a tiny migration on
   development might take a long time to complete on production environment!

> Please refer to the `package.json` of this package for useful scripts that might make it simpler
> for you to write migrations.

## Adding new Postgres migrations

For postgres migrations, just create a new file (copy a previous migration).

Then, adjust the content and migration name as desired. Make sure you import in
[`src/run-pg-migrations.ts`](./src/run-pg-migrations.ts) and add it to the list of migrations to
run.

## ClickHouse Migrations

We aim to avoid ClickHouse data migrations, as they are heavy and complicated to apply.

If you need to apply ClickHouse database structure changes, please try to add and avoid changes to
existing objects.

Follow `src/clickhouse.ts` for more information and the detailed database structure.

## Custom Migrations

You are also able to use TypeScript to write and apply migrations.

To create a custom migration, use the following command:

```
pnpm migration:create --name "do_something.mts" --allow-extension ".mts"
```

> If you need external dependencies at runtime, please make sure to add your dependencies under
> `dependencies` in `package.json`.
