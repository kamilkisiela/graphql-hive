// @vitest-environment happy-dom
import { fireEvent, render, screen } from '@testing-library/react';
import { Tabs } from './tabs';

const laboratory = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('./context', () => ({
  useLaboratory: () => laboratory.current,
}));

const operation = (id: string, name: string) => ({
  id,
  name,
  query: '',
  variables: '',
  headers: '',
  extensions: '',
});

const tab = (id: string, name: string) => ({ id, type: 'operation', data: { id, name } });

const mount = (state: Record<string, unknown> = {}) => {
  const deleteTab = vi.fn();
  const deleteOperation = vi.fn();

  laboratory.current = {
    tabs: [tab('a', 'First'), tab('b', 'Second')],
    activeTab: tab('b', 'Second'),
    operations: [operation('a', 'First'), operation('b', 'Second')],
    history: [],
    tests: [],
    plugins: [],
    setTabs: vi.fn(),
    addTab: vi.fn(),
    deleteTab,
    setActiveTab: vi.fn(),
    addOperation: vi.fn(),
    setOperations: vi.fn(),
    deleteOperation,
    isOperationLoading: () => false,
    goToFullScreen: vi.fn(),
    exitFullScreen: vi.fn(),
    isFullScreen: false,
    enableFullScreen: false,
    ...state,
  };

  render(<Tabs />);

  return { deleteTab, deleteOperation };
};

describe('Tabs', () => {
  it('marks the active tab', () => {
    mount();

    const stateOf = (name: string) =>
      screen.getByText(name).closest('[data-state]')?.getAttribute('data-state');

    expect(stateOf('Second')).toBe('active');
    expect(stateOf('First')).toBe('inactive');
  });

  it('closes a tab from a named button', () => {
    const { deleteTab, deleteOperation } = mount();

    fireEvent.click(screen.getAllByLabelText('Close tab')[0]);

    expect(deleteOperation).toHaveBeenCalledWith('a');
    expect(deleteTab).toHaveBeenCalledWith('a');
  });
});
