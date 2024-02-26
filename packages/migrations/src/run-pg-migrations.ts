import migration_2023_07_27T11_44_36_graphql_endpoint from './actions/2023.07.27T11.44.36.graphql-endpoint';
import { type DatabasePool } from 'slonik';
import migration_2021_03_05T19_06_23_initial from './actions/2021-03-05T19-06-23.initial';
import migration_2021_03_08T11_02_26_urls from './actions/2021-03-08T11-02-26.urls';
import migration_2021_03_09T10_30_35_roles from './actions/2021-03-09T10-30-35.roles';
import migration_2021_03_09T14_02_34_activities from './actions/2021-03-09T14-02-34.activities';
import migration_2021_03_15T19_32_01_commit_project_id from './actions/2021-03-15T19-32-01.commit-project-id';
import migration_2021_04_20T11_30_30_tokens from './actions/2021-04-20T11-30-30.tokens';
import migration_2021_04_30T07_01_57_token_per_target from './actions/2021-04-30T07-01-57.token-per-target';
import migration_2021_04_30T11_47_26_validation from './actions/2021-04-30T11-47-26.validation';
import migration_2021_04_30T18_30_00_persisted_operations from './actions/2021-04-30T18-30-00.persisted-operations';
import migration_2021_05_07T07_28_07_token_last_used_at from './actions/2021-05-07T07-28-07.token-last-used-at';
import migration_2021_06_11T10_46_24_slack_integration from './actions/2021-06-11T10-46-24.slack-integration';
import migration_2021_06_11T15_38_28_alerts from './actions/2021-06-11T15-38-28.alerts';
import migration_2021_08_18T13_20_45_urls from './actions/2021-08-18T13-20-45.urls';
import migration_2021_08_27T14_19_48_non_unique_emails from './actions/2021-08-27T14-19-48.non-unique-emails';
import migration_2021_09_17T14_45_36_token_deleted from './actions/2021.09.17T14.45.36.token-deleted';
import migration_2021_10_07T12_11_13_access_scopes from './actions/2021.10.07T12.11.13.access-scopes';
import migration_2021_11_22T11_23_44_base_schema from './actions/2021.11.22T11.23.44.base-schema';
import migration_2021_12_20T14_05_30_commits_with_targets from './actions/2021.12.20T14.05.30.commits-with-targets';
import migration_2022_01_21T12_34_46_validation_targets from './actions/2022.01.21T12.34.46.validation-targets';
import migration_2022_03_28T10_31_26_github_integration from './actions/2022.03.28T10.31.26.github-integration';
import migration_2022_04_15T14_24_17_hash_tokens from './actions/2022.04.15T14.24.17.hash-tokens';
import migration_2022_05_03T15_58_13_org_rate_limits from './actions/2022.05.03T15.58.13.org_rate_limits';
import migration_2022_05_04T11_01_22_billing_plans from './actions/2022.05.04T11.01.22.billing_plans';
import migration_2022_05_05T08_05_35_commits_metadata from './actions/2022.05.05T08.05.35.commits-metadata';
import migration_2022_07_07T12_15_10_no_schema_pushes_limit from './actions/2022.07.07T12.15.10.no-schema-pushes-limit';
import migration_2022_07_11T10_09_41_get_started_wizard from './actions/2022.07.11T10.09.41.get-started-wizard';
import migration_2022_07_11T20_09_37_migrate_pro_hobby_retention from './actions/2022.07.11T20.09.37.migrate-pro-hobby-retention';
import migration_2022_07_18T10_10_44_target_validation_client_exclusion from './actions/2022.07.18T10.10.44.target-validation-client-exclusion';
import migration_2022_08_25T09_59_16_multiple_invitation_codes from './actions/2022.08.25T09.59.16.multiple-invitation-codes';
import migration_2022_08_26T06_23_24_add_supertokens_id from './actions/2022.08.26T06.23.24.add-supertokens-id';
import migration_2022_09_14T16_09_43_external_projects from './actions/2022.09.14T16.09.43.external-projects';
import migration_2022_10_20T08_00_46_oidc_integrations from './actions/2022.10.20T08.00.46.oidc-integrations';
import migration_2022_11_07T09_30_47_user_table_varchar_to_text from './actions/2022.11.07T09.30.47.user-table-varchar-to-text';
import migration_2022_12_03T09_12_28_organization_transfer from './actions/2022.12.03T09.12.28.organization-transfer';
import migration_2022_12_20T09_20_36_oidc_columns from './actions/2022.12.20T09.20.36.oidc-columns';
import migration_2023_01_04T17_00_23_hobby_7_by_default from './actions/2023.01.04T17.00.23.hobby-7-by-default';
import migration_2023_01_12T17_00_23_cdn_tokens from './actions/2023.01.12T17.00.23.cdn-tokens';
import migration_2023_01_17T10_46_28_import_legacy_s3_keys_to_database_mts from './actions/2023.01.17T10.46.28.import-legacy-s3-keys-to-database';
import migration_2023_01_18T11_03_41_registry_v2 from './actions/2023.01.18T11.03.41.registry-v2';
import migration_2023_02_22T09_27_02_delete_personal_org from './actions/2023.02.22T09.27.02.delete-personal-org';
import migration_2023_03_14T12_14_23_schema_policy from './actions/2023.03.14T12.14.23.schema-policy';
import migration_2023_03_29T11_42_44_feature_flags from './actions/2023.03.29T11.42.44.feature-flags';
import migration_2023_04_03T12_51_36_schema_versions_meta from './actions/2023.04.03T12.51.36.schema-versions-meta';
import migration_2023_05_08T12_23_45_clean_invalid_schema_version_changes from './actions/2023.05.08T12.23.45.clean-invalid-schema-version-changes';
import migration_2023_05_12T08_29_06_store_supergraph_on_schema_versions from './actions/2023.05.12T08.29.06.store-supergraph-on-schema-versions';
import migration_2023_06_01T09_07_53_create_collections from './actions/2023.06.01T09.07.53.create_collections';
import migration_2023_06_06T11_26_04_schema_checks from './actions/2023.06.06T11.26.04.schema-checks';
import migration_2023_07_10T11_26_04_schema_checks_manual_approval from './actions/2023.07.10T11.26.04.schema-checks-manual-approval';
import migration_2023_08_01T11_44_36_schema_checks_expires_at from './actions/2023.08.01T11.44.36.schema-checks-expires-at';
import migration_2023_09_01T09_54_00_zendesk_support from './actions/2023.09.01T09.54.00.zendesk-support';
import migration_2023_09_25T15_23_00_github_check_with_project_name from './actions/2023.09.25T15.23.00.github-check-with-project-name';
import migration_2023_09_28T14_14_14_native_fed_v2 from './actions/2023.09.28T14.14.14.native-fed-v2';
import migration_2023_10_05T11_44_36_schema_checks_github_repository from './actions/2023.10.05T11.44.36.schema-checks-github-repository';
import migration_2023_10_26T12_44_36_schema_checks_filters_index from './actions/2023.10.26T12.44.36.schema-checks-filters-index';
import migration_2023_10_30T00_00_00_drop_persisted_operations from './actions/2023.10.30T00-00-00.drop-persisted-operations';
import migration_2023_11_02T14_41_41_schema_checks_dedup from './actions/2023.11.02T14.41.41.schema-checks-dedup';
import migration_2023_11_09T00_00_00_schema_check_approval from './actions/2023.11.09T00.00.00.schema-check-approval';
import migration_2023_11_20T10_00_00_organization_member_roles from './actions/2023.11.20T10-00-00.organization-member-roles';
import migration_2024_01_08T_10_00_00_schema_version_diff_schema_version_id from './actions/2024.01.08T10-00-00.schema-version-diff-schema-version-id';
import migration_2024_01_12_01T00_00_00_contracts from './actions/2024.01.26T00.00.00.contracts';
import migration_2024_01_12_01T00_00_00_schema_check_pagination_index_update from './actions/2024.01.26T00.00.01.schema-check-pagination-index-update';
import migration_2024_02_19_01T00_00_00_schema_check_store_breaking_change_metadata from './actions/2024.02.19T00.00.01.schema-check-store-breaking-change-metadata';
import { runMigrations } from './pg-migrator';

export const runPGMigrations = (args: { slonik: DatabasePool; runTo?: string }) =>
  runMigrations({
    slonik: args.slonik,
    runTo: args.runTo,
    migrations: [
      migration_2021_03_05T19_06_23_initial,
      migration_2021_03_08T11_02_26_urls,
      migration_2021_03_09T10_30_35_roles,
      migration_2021_03_09T14_02_34_activities,
      migration_2021_03_15T19_32_01_commit_project_id,
      migration_2021_04_20T11_30_30_tokens,
      migration_2021_04_30T07_01_57_token_per_target,
      migration_2021_04_30T11_47_26_validation,
      migration_2021_04_30T18_30_00_persisted_operations,
      migration_2021_05_07T07_28_07_token_last_used_at,
      migration_2021_06_11T10_46_24_slack_integration,
      migration_2021_06_11T15_38_28_alerts,
      migration_2021_08_18T13_20_45_urls,
      migration_2021_08_27T14_19_48_non_unique_emails,
      migration_2021_09_17T14_45_36_token_deleted,
      migration_2021_10_07T12_11_13_access_scopes,
      migration_2021_11_22T11_23_44_base_schema,
      migration_2021_12_20T14_05_30_commits_with_targets,
      migration_2022_01_21T12_34_46_validation_targets,
      migration_2022_03_28T10_31_26_github_integration,
      migration_2022_04_15T14_24_17_hash_tokens,
      migration_2022_05_03T15_58_13_org_rate_limits,
      migration_2022_05_04T11_01_22_billing_plans,
      migration_2022_05_05T08_05_35_commits_metadata,
      migration_2022_07_07T12_15_10_no_schema_pushes_limit,
      migration_2022_07_11T10_09_41_get_started_wizard,
      migration_2022_07_11T20_09_37_migrate_pro_hobby_retention,
      migration_2022_07_18T10_10_44_target_validation_client_exclusion,
      migration_2022_08_25T09_59_16_multiple_invitation_codes,
      migration_2022_08_26T06_23_24_add_supertokens_id,
      migration_2022_09_14T16_09_43_external_projects,
      migration_2022_10_20T08_00_46_oidc_integrations,
      migration_2022_11_07T09_30_47_user_table_varchar_to_text,
      migration_2022_12_03T09_12_28_organization_transfer,
      migration_2022_12_20T09_20_36_oidc_columns,
      migration_2023_01_04T17_00_23_hobby_7_by_default,
      migration_2023_01_12T17_00_23_cdn_tokens,
      migration_2023_01_17T10_46_28_import_legacy_s3_keys_to_database_mts,
      migration_2023_01_18T11_03_41_registry_v2,
      migration_2023_02_22T09_27_02_delete_personal_org,
      migration_2023_03_14T12_14_23_schema_policy,
      migration_2023_03_29T11_42_44_feature_flags,
      migration_2023_04_03T12_51_36_schema_versions_meta,
      migration_2023_05_08T12_23_45_clean_invalid_schema_version_changes,
      migration_2023_05_12T08_29_06_store_supergraph_on_schema_versions,
      migration_2023_06_01T09_07_53_create_collections,
      migration_2023_06_06T11_26_04_schema_checks,
      migration_2023_07_10T11_26_04_schema_checks_manual_approval,
      migration_2023_07_27T11_44_36_graphql_endpoint,
      migration_2023_08_01T11_44_36_schema_checks_expires_at,
      migration_2023_09_01T09_54_00_zendesk_support,
      migration_2023_09_25T15_23_00_github_check_with_project_name,
      migration_2023_09_28T14_14_14_native_fed_v2,
      migration_2023_10_05T11_44_36_schema_checks_github_repository,
      migration_2023_10_26T12_44_36_schema_checks_filters_index,
      migration_2023_10_30T00_00_00_drop_persisted_operations,
      migration_2023_11_02T14_41_41_schema_checks_dedup,
      migration_2023_11_09T00_00_00_schema_check_approval,
      migration_2023_11_20T10_00_00_organization_member_roles,
      migration_2024_01_08T_10_00_00_schema_version_diff_schema_version_id,
      migration_2024_01_12_01T00_00_00_contracts,
      migration_2024_01_12_01T00_00_00_schema_check_pagination_index_update,
      migration_2024_02_19_01T00_00_00_schema_check_store_breaking_change_metadata,
    ],
  });
