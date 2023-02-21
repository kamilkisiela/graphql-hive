ALTER TABLE supertokens_thirdparty_users ALTER COLUMN third_party_user_id TYPE VARCHAR(256);
ALTER TABLE supertokens_emailpassword_users ALTER COLUMN password_hash TYPE VARCHAR(256);