import { useLayoutEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  FileDiff as FileDiffImpl,
  File as FileImpl,
  useWorkerPool,
  Virtualizer,
  WorkerPoolContextProvider,
  type FileDiffProps,
  type FileProps,
} from '@pierre/diffs/react';
import WorkerUrl from '@pierre/diffs/worker/worker.js?worker&url';
import { captureException } from '@sentry/react';
import { useTheme, type ResolvedTheme } from '../theme/theme-provider';

function pierreTheme(resolvedTheme: ResolvedTheme) {
  return resolvedTheme === 'dark' ? 'pierre-dark' : 'pierre-light';
}

function workerFactory(): Worker {
  return new Worker(WorkerUrl, { type: 'module' });
}

export function DiffsWorkerPoolProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  if (typeof Worker === 'undefined') {
    return children;
  }
  return (
    <WorkerPoolContextProvider
      poolOptions={{ workerFactory, poolSize: 2 }}
      highlighterOptions={{ theme: pierreTheme(resolvedTheme), langs: ['graphql'] }}
    >
      {children}
      <WorkerPoolTheme />
    </WorkerPoolContextProvider>
  );
}

function WorkerPoolTheme() {
  const workerPool = useWorkerPool();
  const { resolvedTheme } = useTheme();
  useLayoutEffect(() => {
    // Rejects when the workers fail to start; diffs then highlight on the main thread instead.
    workerPool
      ?.setRenderOptions({ theme: pierreTheme(resolvedTheme) })
      .catch(error => captureException(error, { level: 'warning' }));
  }, [workerPool, resolvedTheme]);
  return null;
}

// Has a height because the virtualizer only renders lines inside its own scroll region.
export function CodeScrollArea(props: { className?: string; children: ReactNode }) {
  return (
    <Virtualizer className={cn('max-h-[70vh] overflow-auto', props.className)}>
      {props.children}
    </Virtualizer>
  );
}

export function File<LAnnotation = undefined, Caret = undefined>(
  props: FileProps<LAnnotation, Caret>,
) {
  const { resolvedTheme } = useTheme();
  return (
    <FileImpl
      {...props}
      options={{
        theme: pierreTheme(resolvedTheme),
        ...props.options,
      }}
    />
  );
}

export function FileDiff<LAnnotation = undefined, Caret = undefined>(
  props: FileDiffProps<LAnnotation, Caret>,
) {
  const { resolvedTheme } = useTheme();
  return (
    <FileDiffImpl
      {...props}
      options={{
        theme: pierreTheme(resolvedTheme),
        ...props.options,
      }}
    />
  );
}
