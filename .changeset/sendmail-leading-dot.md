---
'hive': patch
---

Fix links in emails sent with `EMAIL_PROVIDER=sendmail` losing a dot (for example
`…prod.proddsl.example…` arriving as `…prod.proddslexample…`). The body is now base64-encoded, so no
line can start with a "." that the receiving server would strip.
