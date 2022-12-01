# hive-graphql helm-chart

Helm chart to run graphql-hive in kubernetes

## Getting started
```
helm install graphql-hive . --dependency-update
```

# Values
| Key                                                              | Type   | Default                                  | Description                                                                                                    |
|:-----------------------------------------------------------------|:-------|:-----------------------------------------|:---------------------------------------------------------------------------------------------------------------|
| global.image.tag                                                 | string | 59b64c36c866b3555c135c70de76a884e63f8619 | Image tag of [graphql-hive](https://github.com/kamilkisiela/graphql-hive/pkgs/container/graphql-hive%2Femails) |
| global.app_base_url                                              | string | base.url.io                              | URL where graphql-hive is going to be hosted                                                                   |
| global.clickhouse_username                                       | string | default                                  | If you change this variable, you need to override admin-password in clickhouse secret                          |
| global.postgresql.auth.database                                  | string | graphql-hive                             |                                                                                                                |
| global.postgresql.auth.user                                      | string | postgres                                 | If you change this variable, you need to override postgres-password in postgres-postgresql secret              |
| global.apiKey.key                                                | string | yourApiKey                               | Supertoken's API key                                                                                           |
| global.encryption_secret                                         | string | yourEncryptionSecret                     |                                                                                                                |
| global.email.provider                                            | string | sendmail                                 | The email provider that should be used for sending emails. Possible valies: sendmail, smtp, postmark or mock   |
| global.email.from                                                | string | no-reply@yourDomain.com                  | The email address used for sending emails                                                                      |
| graphql-hive.ingress.use_secure_protocol                         | string | false                                    | True for https, false for http                                                                                 |
| graphql-hive.hive-emails.email_provider_smtp_protocol            | string |                                          | If global.email.provider is **smtp**. "smtp" or "smtps"                                                        |
| graphql-hive.hive-emails.email_provider_smtp_host                | string |                                          | If global.email.provider is **smtp**. SMTP server address                                                      |
| graphql-hive.hive-emails.email_provider_smtp_port                | string |                                          | If global.email.provider is **smtp**. SMTP server port                                                         |
| graphql-hive.hive-emails.email_provider_smtp_reject_unauthorized | string |                                          | If global.email.provider is **smtp**. If your smtp server has self-signed certificate value must be '0'        |

