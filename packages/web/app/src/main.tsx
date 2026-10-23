import 'regenerator-runtime/runtime';
import ReactDOM from 'react-dom/client';
import { env } from '@/env/frontend';
import { urqlClient } from '@/lib/urql';
import { init } from '@sentry/react';
import { RouterProvider } from '@tanstack/react-router';
import './index.css';
import { clearChunkReloadFlag, isChunkLoadError, reloadOnChunkError } from './lib/chunk-error';
import { createAppRouter } from './router';

// Register things for typesafety
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}

// App-wide side effects live here, not in the router module, so the route tree can be imported
// (tests, previews) without initializing Sentry or touching the network.
if (env.sentry) {
  init({
    dsn: env.sentry.dsn,
    enabled: true,
    dist: 'webapp',
    release: env.release,
    environment: env.environment,
    ignoreErrors: [
      // Suppress specific monaco editor internal errors
      "Failed to execute 'setStart' on 'Range'",
      "Failed to execute 'setEnd' on 'Range'",
      /TextModel got disposed/,
      // Stale chunk errors after deployments — handled by auto-reload below
      /Failed to fetch dynamically imported module/,
      /Importing a module script failed/,
    ],
    beforeSend(event) {
      const isMonacoError = event.exception?.values?.some(exception =>
        exception.stacktrace?.frames?.some(frame => frame.filename?.includes('monaco-editor')),
      );

      if (isMonacoError) {
        for (const exception of event.exception?.values ?? []) {
          exception.value &&= `[Monaco] ${exception.value}`;
        }
      }

      return event;
    },
  });
}

Error.stackTraceLimit = 15;

clearChunkReloadFlag();

// After a deployment, JS chunk filenames change (content hashes). Users with a
// stale browser tab still reference old chunks that no longer exist on the CDN.
// Vite wraps dynamic imports with a preload helper that emits this event when
// a chunk or its CSS/JS dependencies fail to load. We catch it here and reload
// the page so the browser fetches fresh HTML with the correct chunk references.
// See: https://vite.dev/guide/build.html#load-error-handling
window.addEventListener('vite:preloadError', () => {
  // Don't call preventDefault() — that flips Vite into a silent branch where
  // the failed import resolves to `undefined`, causing downstream destructures
  // (e.g. lazy() callers) to throw a cryptic TypeError before the reload runs.
  // Letting the error propagate routes it through the unhandledrejection and
  // error-boundary handlers below, which also reload on isChunkLoadError.
  reloadOnChunkError();
});

// Not all dynamic imports go through Vite's preload wrapper. React.lazy() calls,
// nested dynamic imports inside already-loaded chunks, and third-party code (e.g.
// Monaco editor) do their own import() calls that Vite doesn't instrument. When
// these fail, the browser rejects the import promise with no handler, surfacing
// as an unhandled promise rejection. We check for the specific browser error
// messages that indicate a stale chunk, and reload if matched.
window.addEventListener('unhandledrejection', event => {
  if (isChunkLoadError(event.reason)) {
    // Suppress the rejection — a reload will resolve it.
    event.preventDefault();
    reloadOnChunkError();
  }
});

const router = createAppRouter({ urqlClient });

ReactDOM.createRoot(document.getElementById('root')!).render(<RouterProvider router={router} />);
