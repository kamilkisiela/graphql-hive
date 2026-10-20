---
'hive': minor
---

Support routing server-side OAuth requests through the request broker so OAuth providers do not see the IP addresses of Hive cluster nodes. This applies to GitHub, Google, Okta, and organization OIDC token and user-information requests.

Self-hosters who need to hide their cluster IP addresses must configure the `server` service with:

- `REQUEST_BROKER=1`
- `REQUEST_BROKER_ENDPOINT=<broker URL>`
- `REQUEST_BROKER_SIGNATURE=<shared broker signature>`
