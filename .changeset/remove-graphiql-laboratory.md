---
'hive': minor
---

Remove the GraphiQL laboratory tab. The Hive Laboratory is now the only laboratory: it runs the same preflight scripts with a compatible runtime, and on a user's first visit it carries over their GraphiQL environment variables and preflight toggle before clearing the GraphiQL-era browser storage. GraphiQL's own unsaved tabs and run history are not carried over; collections, operations and preflight scripts are stored server-side and are unaffected. The development-only `/dev` GraphiQL page is removed as well.
