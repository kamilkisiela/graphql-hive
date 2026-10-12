---
'hive': patch
---

Fix the `no-unreachable-types` schema policy rule reusing the reachable types of the first schema it linted, which reported reachable types as unreachable (and the reverse) for every later check until the policy service restarted.
