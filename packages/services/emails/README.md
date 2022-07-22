# Emails

Optional service for sending emails.

```bash
EMAIL_PROVIDER="postmark"           # only Postmark is supported
EMAIL_FROM="kamil@graphql-hive.com" # sender email address

# Specific to Postmark
POSTMARK_TOKEN="<required>"
POSTMARK_MESSAGE_STREAM="<required>"
```

Used by services: `rate-limit`.
