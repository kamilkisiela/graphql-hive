---
'@graphql-hive/apollo': minor
---

Better HTTP info, error and debug logging.

For the supergraph manager, pass a `console` instance as the `logger` property.

```ts
import { createSupergraphManager } from '@graphql-hive/apollo';

const manager = createSupergraphManager({
  ...otherOptions,
  logger: console,
})
```

For the supergraph SDL fetcher pass a `console`  instance as the `logger` property.

```ts
import { createSupergraphSDLFetcher } from '@graphql-hive/apollo';

const manager = createSupergraphSDLFetcher({
  ...otherOptions,
  logger: console,
})
```