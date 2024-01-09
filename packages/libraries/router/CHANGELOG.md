# 09.01.2024

- Introduce `HIVE_CDN_SCHEMA_FILE_PATH` environment variable to specify where to download the supergraph schema (default is `./supergraph-schema.graphql`)

# 11.07.2023

- Use debug level when logging dropped operations

# 07.06.2023

- Introduce `enabled` flag (Usage Plugin)

# 23.08.2022

- Don't panic on scalars used as variable types
- Introduce `buffer_size`
- Ignore operations including `__schema` or `__type`