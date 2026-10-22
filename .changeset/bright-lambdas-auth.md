---
'hive': patch
---

Support using AWS IAM credentials for S3 access from the artifacts Lambda instead of static access keys.

To use the Lambda execution role, grant it `s3:GetObject` access to the artifact bucket and configure
the Lambda environment variables as follows:

```sh
AWS_S3_IAM_AUTH_ENABLED=1
AWS_S3_ENDPOINT=https://s3.us-east-1.amazonaws.com
AWS_S3_BUCKET_NAME=my-artifacts-bucket
```
