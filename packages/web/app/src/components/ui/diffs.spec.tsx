// @vitest-environment jsdom
import { useContext } from 'react';
import { WorkerPoolManager } from '@pierre/diffs/worker';
import { captureException } from '@sentry/react';
import { render, screen, waitFor } from '@testing-library/react';
import { DiffsWorkerPoolProvider, File } from './diffs';

const theme = vi.hoisted(() => ({ resolvedTheme: 'light' as 'light' | 'dark' }));

vi.mock('@sentry/react', () => ({ captureException: vi.fn() }));
vi.mock('@/components/theme/theme-provider', () => ({ useTheme: () => theme }));
vi.mock('@pierre/diffs/worker', () => ({
  WorkerPoolManager: vi.fn(
    class {
      constructor(
        _: unknown,
        private renderOptions: { theme: string },
      ) {}
      getDiffRenderOptions = () => this.renderOptions;
      initialize = vi.fn(() => Promise.resolve());
      setRenderOptions = vi.fn((options: { theme: string }) => {
        this.renderOptions = options;
        return Promise.resolve();
      });
      terminate = vi.fn();
    },
  ),
}));
// Stands in for the library's File, which reads the pool from context when it mounts.
vi.mock('@pierre/diffs/react', async importOriginal => {
  const actual = await importOriginal<typeof import('@pierre/diffs/react')>();
  return {
    ...actual,
    File: () => {
      const pool = useContext(actual.WorkerPoolContext);
      return <div data-cy="file">{pool ? 'pooled' : 'main thread'}</div>;
    },
  };
});

const file = { name: 'schema.graphql', contents: 'type Query { a: String }' };

function pools() {
  return vi.mocked(WorkerPoolManager).mock.instances as unknown as Array<{
    initialize: ReturnType<typeof vi.fn>;
    setRenderOptions: ReturnType<typeof vi.fn>;
    terminate: ReturnType<typeof vi.fn>;
  }>;
}

beforeEach(() => {
  vi.stubGlobal('Worker', class {});
  vi.mocked(WorkerPoolManager).mockClear();
  vi.mocked(captureException).mockClear();
  theme.resolvedTheme = 'light';
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test('starts no workers until a diff renders', () => {
  render(<DiffsWorkerPoolProvider>details</DiffsWorkerPoolProvider>);

  expect(WorkerPoolManager).not.toHaveBeenCalled();
});

test('diffs share one pool started in the current theme, stopped when the provider unmounts', () => {
  theme.resolvedTheme = 'dark';
  const { unmount } = render(
    <DiffsWorkerPoolProvider>
      <File file={file} />
      <File file={file} />
    </DiffsWorkerPoolProvider>,
  );

  expect(screen.getAllByText('pooled')).toHaveLength(2);
  expect(WorkerPoolManager).toHaveBeenCalledTimes(1);
  expect(WorkerPoolManager).toHaveBeenCalledWith(expect.objectContaining({ poolSize: 2 }), {
    theme: 'pierre-dark',
    langs: ['graphql'],
  });

  unmount();
  expect(pools()[0].terminate).toHaveBeenCalledTimes(1);
});

test('diffs outside a provider highlight on the main thread', () => {
  render(<File file={file} />);

  expect(screen.getByText('main thread')).toBeTruthy();
  expect(WorkerPoolManager).not.toHaveBeenCalled();
});

test('a theme change reaches the pool once it exists', () => {
  const { rerender } = render(
    <DiffsWorkerPoolProvider>
      <File file={file} />
    </DiffsWorkerPoolProvider>,
  );

  theme.resolvedTheme = 'dark';
  rerender(
    <DiffsWorkerPoolProvider>
      <File file={file} />
    </DiffsWorkerPoolProvider>,
  );

  expect(pools()[0].setRenderOptions).toHaveBeenCalledTimes(1);
  expect(pools()[0].setRenderOptions).toHaveBeenCalledWith({ theme: 'pierre-dark' });
});

test('a worker pool that fails to start is reported as a warning, not an unhandled rejection', async () => {
  const error = new Error('WorkerPoolManager: worker initialization timed out after 10000ms');
  vi.mocked(WorkerPoolManager).mockImplementationOnce(
    class {
      getDiffRenderOptions = () => ({ theme: 'pierre-light' });
      initialize = vi.fn(() => Promise.reject(error));
      setRenderOptions = vi.fn(() => Promise.reject(error));
      terminate = vi.fn();
    } as never,
  );

  const { rerender } = render(
    <DiffsWorkerPoolProvider>
      <File file={file} />
    </DiffsWorkerPoolProvider>,
  );
  theme.resolvedTheme = 'dark';
  rerender(
    <DiffsWorkerPoolProvider>
      <File file={file} />
    </DiffsWorkerPoolProvider>,
  );

  await waitFor(() => {
    expect(captureException).toHaveBeenCalledTimes(2);
  });
  expect(captureException).toHaveBeenCalledWith(error, { level: 'warning' });
});
