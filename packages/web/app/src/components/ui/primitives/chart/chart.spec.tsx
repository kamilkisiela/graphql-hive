// @vitest-environment jsdom
import { act, render } from '@testing-library/react';
import { Chart } from './chart';

const instance = {
  setOption: vi.fn(),
  resize: vi.fn(),
  dispose: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
};
const init = vi.fn(() => instance);

vi.mock('echarts', () => ({ init: (...args: unknown[]) => init(...(args as [])) }));

let observed: ResizeObserverCallback | undefined;

class ResizeObserverStub {
  constructor(callback: ResizeObserverCallback) {
    observed = callback;
  }
  observe() {}
  disconnect() {}
}

function resizeTo(width: number, height: number) {
  act(() => {
    observed!([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver);
  });
}

// jsdom lays nothing out, so every element reports 0x0 unless told otherwise.
function mountSize(width: number, height: number) {
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(width);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(height);
}

beforeAll(() => {
  vi.stubGlobal('ResizeObserver', ResizeObserverStub);
});

beforeEach(() => {
  vi.restoreAllMocks();
  vi.clearAllMocks();
  observed = undefined;
  mountSize(400, 200);
});

describe('Chart', () => {
  it('creates one instance and sets the option once on mount', () => {
    const option = { series: [] };
    render(<Chart option={option} height={200} />);
    expect(init).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenCalledWith(option);
  });

  it('mounts ECharts out of normal flow so its pixel width never widens the page', () => {
    const { container } = render(<Chart option={{}} height={200} />);
    const host = container.firstChild as HTMLElement;
    const mount = (init.mock.calls[0] as unknown[])[0] as HTMLElement;
    expect(host.className).toContain('relative');
    expect(host.style.height).toBe('200px');
    expect(mount.parentElement).toBe(host);
    expect(mount.className).toContain('absolute');
  });

  it('keeps the instance across re-renders and sets only a changed option', () => {
    const option = { series: [] };
    const { rerender } = render(<Chart option={option} height={200} />);
    rerender(<Chart option={option} height={200} />);
    expect(instance.setOption).toHaveBeenCalledTimes(1);

    const next = { series: [{ type: 'line' as const, data: [1] }] };
    rerender(<Chart option={next} height={200} />);
    expect(init).toHaveBeenCalledTimes(1);
    expect(instance.setOption).toHaveBeenCalledTimes(2);
    expect(instance.setOption).toHaveBeenLastCalledWith(next);
  });

  it('binds events and unbinds them with the instance on unmount', () => {
    const click = vi.fn();
    const { unmount } = render(<Chart option={{}} height={200} onEvents={{ click }} />);
    expect(instance.on).toHaveBeenCalledWith('click', click);
    unmount();
    expect(instance.off).toHaveBeenCalledWith('click', click);
    expect(instance.dispose).toHaveBeenCalledTimes(1);
  });

  it('resizes the instance when its container resizes', () => {
    render(<Chart option={{}} height={200} />);
    resizeTo(500, 200);
    expect(init).toHaveBeenCalledTimes(1);
    expect(instance.resize).toHaveBeenCalledTimes(1);
  });

  describe('in a container with no size, as under display: none', () => {
    beforeEach(() => {
      mountSize(0, 0);
    });

    it('waits for a size before creating the instance', () => {
      render(<Chart option={{}} height={200} />);
      expect(init).not.toHaveBeenCalled();
      resizeTo(0, 0);
      expect(init).not.toHaveBeenCalled();
    });

    it('creates the instance on the first size with the latest option, then only resizes', () => {
      const { rerender } = render(<Chart option={{ series: [] }} height={200} />);
      const latest = { series: [{ type: 'line' as const, data: [1] }] };
      rerender(<Chart option={latest} height={200} />);

      resizeTo(400, 200);
      expect(init).toHaveBeenCalledTimes(1);
      expect(instance.setOption).toHaveBeenCalledTimes(1);
      expect(instance.setOption).toHaveBeenCalledWith(latest);

      resizeTo(500, 200);
      expect(init).toHaveBeenCalledTimes(1);
      expect(instance.resize).toHaveBeenCalledTimes(1);
    });

    it('binds events given before the instance exists', () => {
      const click = vi.fn();
      render(<Chart option={{}} height={200} onEvents={{ click }} />);
      expect(instance.on).not.toHaveBeenCalled();
      resizeTo(400, 200);
      expect(instance.on).toHaveBeenCalledWith('click', click);
    });

    it('unmounts cleanly before the instance exists', () => {
      const { unmount } = render(<Chart option={{}} height={200} />);
      expect(() => unmount()).not.toThrow();
      expect(instance.dispose).not.toHaveBeenCalled();
    });
  });
});
