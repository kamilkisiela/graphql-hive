--initial (down)

DROP TABLE IF EXISTS version_commit;
DROP TABLE IF EXISTS versions;
DROP TABLE IF EXISTS tokens;
DROP TABLE IF EXISTS targets;
DROP TABLE IF EXISTS commits;

DROP TABLE IF EXISTS projects;
DROP TABLE IF EXISTS organization_member;
DROP TABLE IF EXISTS organizations;
DROP TABLE IF EXISTS users;

DROP INDEX IF EXISTS email_idx;
DROP INDEX IF EXISTS external_auth_user_id_idx;

DROP TYPE IF EXISTS organization_type;
DROP DOMAIN IF EXISTS url;
DROP DOMAIN IF EXISTS slug;
