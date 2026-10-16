// @vitest-environment jsdom
import { captureException } from '@sentry/react';
import { render, waitFor } from '@testing-library/react';
import { DiffsWorkerPoolProvider } from './diffs';

const pool = vi.hoisted(() => ({
  setRenderOptions: vi.fn<() => Promise<void>>(),
}));

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('@/components/theme/theme-provider', () => ({
  useTheme: () => ({ resolvedTheme: 'light' }),
}));
vi.mock('@pierre/diffs/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@pierre/diffs/react')>();
  return {
    ...actual,
    WorkerPoolContextProvider: ({ children }: { children: React.ReactNode }) => (
      <actual.WorkerPoolContext.Provider value={pool as never}>
        {children}
      </actual.WorkerPoolContext.Provider>
    ),
  };
});

beforeEach(() => {
  vi.stubGlobal('Worker', class {});
  vi.mocked(captureException).mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('a worker pool that fails to start is reported as a warning, not an unhandled rejection', async () => {
  const error = new Error('WorkerPoolManager: worker initialization timed out after 10000ms');
  pool.setRenderOptions.mockRejectedValue(error);

  render(<DiffsWorkerPoolProvider>diff</DiffsWorkerPoolProvider>);

  await waitFor(() => {
    expect(captureException).toHaveBeenCalledWith(error, { level: 'warning' });
  });
});
