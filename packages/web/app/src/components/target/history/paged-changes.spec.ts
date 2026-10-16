// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { changeKindLabel, CHANGES_PAGE_SIZE, usePagedChanges } from './paged-changes';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const firstPage = ['a'];
// Three pages: two full and a partial one.
const totalCount = CHANGES_PAGE_SIZE * 2 + 20;

describe('usePagedChanges', () => {
  it('keeps the current page while the next loads, then switches to it', async () => {
    const page = deferred<string[]>();
    const loadPage = vi.fn(() => page.promise);
    const { result } = renderHook(() =>
      usePagedChanges({ firstPage, totalCount, loadPage, resetKey: 'check-1' }),
    );
    expect(result.current.pageCount).toBe(3);

    act(() => result.current.goTo(1));
    expect(loadPage).toHaveBeenCalledWith(CHANGES_PAGE_SIZE);
    expect(result.current).toMatchObject({ rows: firstPage, pageIndex: 0, loading: true });

    await act(async () => page.resolve(['b']));
    expect(result.current).toMatchObject({ rows: ['b'], pageIndex: 1, loading: false });
  });

  it('ignores a page that arrives after a newer request', async () => {
    const slow = deferred<string[]>();
    const fast = deferred<string[]>();
    const loadPage = vi
      .fn<(offset: number) => Promise<string[]>>()
      .mockReturnValueOnce(slow.promise)
      .mockReturnValueOnce(fast.promise);
    const { result } = renderHook(() =>
      usePagedChanges({ firstPage, totalCount, loadPage, resetKey: 'check-1' }),
    );

    act(() => result.current.goTo(1));
    act(() => result.current.goTo(2));
    await act(async () => fast.resolve(['c']));
    await act(async () => slow.resolve(['b']));

    expect(result.current).toMatchObject({ rows: ['c'], pageIndex: 2, loading: false });
  });

  it('says a page failed and stays where it was', async () => {
    const page = deferred<string[]>();
    const { result } = renderHook(() =>
      usePagedChanges({
        firstPage,
        totalCount,
        loadPage: () => page.promise,
        resetKey: 'check-1',
      }),
    );

    act(() => result.current.goTo(1));
    await act(async () => page.reject(new Error('offline')));

    expect(result.current).toMatchObject({
      rows: firstPage,
      pageIndex: 0,
      loading: false,
      failed: true,
    });
  });

  it('starts over on the first page of another list', async () => {
    const { result, rerender } = renderHook(
      (props: { resetKey: string; firstPage: string[] }) =>
        usePagedChanges({
          ...props,
          totalCount,
          loadPage: async () => ['b'],
        }),
      { initialProps: { resetKey: 'check-1', firstPage } },
    );

    await act(async () => result.current.goTo(1));
    expect(result.current.pageIndex).toBe(1);

    rerender({ resetKey: 'check-2', firstPage: ['z'] });
    expect(result.current).toMatchObject({ rows: ['z'], pageIndex: 0 });
  });

  it('does not carry a pending or failed page into another list', async () => {
    const page = deferred<string[]>();
    const { result, rerender } = renderHook(
      (props: { resetKey: string }) =>
        usePagedChanges({ ...props, firstPage, totalCount, loadPage: () => page.promise }),
      { initialProps: { resetKey: 'contract-1' } },
    );

    act(() => result.current.goTo(1));
    expect(result.current.loading).toBe(true);

    rerender({ resetKey: 'contract-2' });
    expect(result.current).toMatchObject({ pageIndex: 0, loading: false, failed: false });

    await act(async () => page.reject(new Error('offline')));
    expect(result.current).toMatchObject({ pageIndex: 0, loading: false, failed: false });
  });
});

describe('changeKindLabel', () => {
  it('reads an Inspector change type as a sentence', () => {
    expect(changeKindLabel('TYPE_DESCRIPTION_CHANGED')).toBe('Type description changed');
    expect(changeKindLabel('FIELD_ADDED')).toBe('Field added');
  });
});
