---
'hive': patch
---

Allow a usage report that's already down to a single operation map key (e.g.
one "hot" operation called very often in one flush interval) to keep being
split by dividing its operations/subscriptionOperations/errors, instead of
being dropped outright once it can no longer be divided by map key. Each
error is routed into the same split chunk as the operation it came from, so
a chunk that's later dropped or sent independently can never separate an
operation from the errors it produced.
