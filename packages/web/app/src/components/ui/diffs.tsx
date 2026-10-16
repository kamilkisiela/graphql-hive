import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import {
  FileDiff as FileDiffImpl,
  File as FileImpl,
  Virtualizer,
  WorkerPoolContext,
  type FileDiffProps,
  type FileProps,
} from '@pierre/diffs/react';
import { WorkerPoolManager } from '@pierre/diffs/worker';
import WorkerUrl from '@pierre/diffs/worker/worker.js?worker&url';
import { captureException } from '@sentry/react';
import { useTheme, type ResolvedTheme } from '../theme/theme-provider';

type PierreTheme = ReturnType<typeof pierreTheme>;

function pierreTheme(resolvedTheme: ResolvedTheme) {
  return resolvedTheme === 'dark' ? 'pierre-dark' : 'pierre-light';
}

function workerFactory(): Worker {
  return new Worker(WorkerUrl, { type: 'module' });
}

// Diffs then highlight on the main thread instead.
function reportPoolFailure(error: unknown) {
  captureException(error, { level: 'warning' });
}

const GetWorkerPoolContext = createContext<((theme: PierreTheme) => WorkerPoolManager) | undefined>(
  undefined,
);

/**
 * Starts the highlighting workers when the first diff renders, not when the page mounts: most
 * check visits never open a schema tab. Each provider owns its pool, so a page being left can't
 * stop the pool of the page replacing it.
 */
export function DiffsWorkerPoolProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const poolRef = useRef<WorkerPoolManager | null>(null);

  const getPool = useCallback((theme: PierreTheme) => {
    if (poolRef.current == null) {
      poolRef.current = new WorkerPoolManager(
        { workerFactory, poolSize: 2 },
        { theme, langs: ['graphql'] },
      );
      poolRef.current.initialize().catch(reportPoolFailure);
    }
    return poolRef.current;
  }, []);

  useLayoutEffect(() => {
    const pool = poolRef.current;
    const theme = pierreTheme(resolvedTheme);
    if (pool == null || pool.getDiffRenderOptions().theme === theme) {
      return;
    }
    pool.setRenderOptions({ theme }).catch(reportPoolFailure);
  }, [resolvedTheme]);

  useEffect(
    () => () => {
      poolRef.current?.terminate();
      poolRef.current = null;
    },
    [],
  );

  if (typeof Worker === 'undefined') {
    return children;
  }
  return <GetWorkerPoolContext.Provider value={getPool}>{children}</GetWorkerPoolContext.Provider>;
}

// The library reads the pool once, when a diff mounts, so it has to exist by then. Later calls
// return the same pool, so the theme only matters to the first diff.
function useWorkerPool(theme: PierreTheme) {
  return useContext(GetWorkerPoolContext)?.(theme);
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
  const pool = useWorkerPool(pierreTheme(resolvedTheme));
  return (
    <WorkerPoolContext.Provider value={pool}>
      <FileImpl
        {...props}
        options={{
          theme: pierreTheme(resolvedTheme),
          ...props.options,
        }}
      />
    </WorkerPoolContext.Provider>
  );
}

export function FileDiff<LAnnotation = undefined, Caret = undefined>(
  props: FileDiffProps<LAnnotation, Caret>,
) {
  const { resolvedTheme } = useTheme();
  const pool = useWorkerPool(pierreTheme(resolvedTheme));
  return (
    <WorkerPoolContext.Provider value={pool}>
      <FileDiffImpl
        {...props}
        options={{
          theme: pierreTheme(resolvedTheme),
          ...props.options,
        }}
      />
    </WorkerPoolContext.Provider>
  );
}
