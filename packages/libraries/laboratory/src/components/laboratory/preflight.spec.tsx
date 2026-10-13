// @vitest-environment happy-dom
import { render, screen } from '@testing-library/react';
import { Preflight } from './preflight';

const laboratory = vi.hoisted(() => ({ current: {} as Record<string, unknown> }));

vi.mock('./context', () => ({
  useLaboratory: () => laboratory.current,
}));

vi.mock('./editor', () => ({ Editor: () => null }));

const mount = (state: Record<string, unknown> = {}) => {
  laboratory.current = {
    preflight: { enabled: true, script: 'console.log("hi")' },
    preflightLogs: [],
    plugins: [],
    pluginsState: {},
    checkPermissions: () => true,
    setPreflight: vi.fn(),
    setEnv: vi.fn(),
    setPluginsState: vi.fn(),
    setLastTestResult: vi.fn(),
    ...state,
  };

  render(<Preflight />);
};

describe('Preflight', () => {
  it('shows where in the script a log came from', () => {
    mount({
      preflightLogs: [
        {
          level: 'log',
          message: ['hi'],
          createdAt: '2026-01-01T00:00:00.000Z',
          line: 2,
          column: 1,
        },
      ],
    });

    expect(screen.getByText('(2:1)')).toBeDefined();
  });

  it('marks each log line with its level inside a log region', () => {
    mount({
      preflightLogs: [
        { level: 'warn', message: ['careful'], createdAt: '2026-01-01T00:00:00.000Z' },
      ],
    });

    const list = screen.getByRole('log', { name: 'Preflight logs' });

    expect(list.querySelector('[data-level="warn"]')?.textContent).toContain('careful');
  });

  // The script runs in the browser of whoever opens the lab, so the warning is for readers
  // as much as for the person allowed to edit it.
  it.each([true, false])('warns about secrets when editable is %s', canUpdate => {
    mount({ checkPermissions: () => canUpdate });

    expect(screen.getByText(/run in this browser/)).toBeDefined();
    expect(screen.getByText(/lab\.prompt\(\)/)).toBeDefined();
  });

  // Where a script is stored and who else can read it differs per host, so the package says
  // neither and the host adds what applies to it.
  it('says nothing about storage or sharing on its own', () => {
    mount();

    expect(screen.queryByText(/plain text/)).toBeNull();
    expect(screen.queryByText(/anyone/i)).toBeNull();
  });

  it('appends the notice the host supplies', () => {
    mount({ preflightNotice: 'Stored on this target, where everyone with access can read it.' });

    expect(screen.getByText(/everyone with access can read it/)).toBeDefined();
  });
});
