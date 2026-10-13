// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react';
import { useTabs, type LaboratoryTab } from './tabs';

const operationTab = (id: string): LaboratoryTab => ({
  id,
  type: 'operation',
  data: { id: `op-${id}`, name: id },
});

describe('useTabs', () => {
  it('seeds from defaultTabs and selects the tab matching defaultActiveTabId', () => {
    const { result } = renderHook(() =>
      useTabs({ defaultTabs: [operationTab('t1'), operationTab('t2')], defaultActiveTabId: 't2' }),
    );
    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.activeTab?.id).toBe('t2');
  });

  it('falls back to the first tab when defaultActiveTabId is not provided', () => {
    const { result } = renderHook(() =>
      useTabs({ defaultTabs: [operationTab('t0'), operationTab('t1')] }),
    );
    expect(result.current.activeTab?.id).toBe('t0');
  });

  it('addTab appends a tab with a generated id and fires onTabsChange', () => {
    const onTabsChange = vi.fn();
    const { result } = renderHook(() => useTabs({ onTabsChange }));

    let created: LaboratoryTab;
    act(() => {
      created = result.current.addTab({ type: 'settings', data: {} });
    });

    expect(created!.id).toBeTruthy();
    expect(result.current.tabs).toHaveLength(1);
    expect(onTabsChange).toHaveBeenCalledWith([created!]);
  });

  it('does not dedupe: adding the same tab shape twice yields two distinct tabs', () => {
    const { result } = renderHook(() => useTabs({}));

    act(() => {
      result.current.addTab({ type: 'settings', data: {} });
    });
    act(() => {
      result.current.addTab({ type: 'settings', data: {} });
    });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.tabs[0].id).not.toBe(result.current.tabs[1].id);
  });

  it('setActiveTab fires onActiveTabIdChange with the tab id', () => {
    const onActiveTabIdChange = vi.fn();
    const t1 = operationTab('t1');
    const { result } = renderHook(() => useTabs({ defaultTabs: [t1], onActiveTabIdChange }));

    act(() => {
      result.current.setActiveTab(t1);
    });

    expect(onActiveTabIdChange).toHaveBeenCalledWith('t1');
  });

  it('deleteTab removes the tab and fires onTabsChange', () => {
    const onTabsChange = vi.fn();
    const { result } = renderHook(() =>
      useTabs({ defaultTabs: [operationTab('t1')], onTabsChange }),
    );

    act(() => {
      result.current.deleteTab('t1');
    });

    expect(result.current.tabs).toHaveLength(0);
    expect(onTabsChange).toHaveBeenCalledWith([]);
  });

  it('updateTab replaces the tab data and fires onTabsChange', () => {
    const onTabsChange = vi.fn();
    const { result } = renderHook(() =>
      useTabs({ defaultTabs: [operationTab('t1')], onTabsChange }),
    );

    act(() => {
      result.current.updateTab('t1', { id: 'op-t1', name: 'Updated' });
    });

    expect((result.current.tabs[0].data as { name: string }).name).toBe('Updated');
    expect(onTabsChange).toHaveBeenCalledWith([
      expect.objectContaining({ id: 't1', data: expect.objectContaining({ name: 'Updated' }) }),
    ]);
  });
});

describe('useTabs replaceOperationId', () => {
  it('points the tab and the active tab at the persisted operation id', () => {
    const onTabsChange = vi.fn();
    const { result } = renderHook(() =>
      useTabs({
        defaultTabs: [operationTab('t1'), operationTab('t2')],
        defaultActiveTabId: 't1',
        onTabsChange,
      }),
    );

    act(() => {
      result.current.replaceOperationId('op-t1', 'server-op');
    });

    expect(result.current.tabs.map(t => (t.data as { id: string }).id)).toEqual([
      'server-op',
      'op-t2',
    ]);
    expect((result.current.activeTab?.data as { id: string }).id).toBe('server-op');
    expect(onTabsChange).toHaveBeenCalledWith(result.current.tabs);
  });
});

describe('useTabs replaceOperationId after later changes', () => {
  // The host answers a save asynchronously, so the rename may run through a callback captured
  // before more tabs were added; it must not write the older tab list back.
  it('keeps tabs added after the callback was captured', () => {
    const { result } = renderHook(() => useTabs({ defaultTabs: [operationTab('t1')] }));
    const staleReplace = result.current.replaceOperationId;

    act(() => {
      result.current.addTab({ type: 'operation', data: { id: 'op-t2', name: 't2' } });
    });
    act(() => {
      staleReplace('op-t1', 'server-op');
    });

    expect(result.current.tabs.map(t => (t.data as { id: string }).id)).toEqual([
      'server-op',
      'op-t2',
    ]);
  });
});
