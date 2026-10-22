---
'hive': patch
---

Fix the usage buffer's retry-on-oversized-payload behavior. It used to shred
every report's internals in one shot as soon as a flush was too big, and gave
up permanently (with no visibility) the moment that wasn't enough - so a
batch of many reports would get its internals split even when simply
redistributing the existing reports into smaller batches would have worked.

Now it first tries redistributing existing reports into smaller/more
batches, and only splits a report's own internals once it's alone in a batch
and still too big, repeating as needed until each piece fits or is
irreducible - at which point it's dropped with a logged error, a Sentry
event, and a dedicated metric instead of vanishing silently. Splitting a
report's internals also no longer silently drops its subscriptionOperations,
errors, or appDeploymentUsageTimestamps.
