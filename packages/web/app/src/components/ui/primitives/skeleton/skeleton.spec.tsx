// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { Skeleton } from './skeleton';
import * as styles from './skeleton.css';

describe('Skeleton', () => {
  it('is a hidden, shimmering line of body-text height by default', () => {
    const { container } = render(<Skeleton />);
    const element = container.firstElementChild!;
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.className).toContain(styles.skeletonVariants());
  });

  it('fills its parent as a block and ignores line sizing', () => {
    const { container } = render(
      <Skeleton variants={{ shape: 'block', size: 'xl', width: 'xs' }} />,
    );
    const className = container.firstElementChild!.className;
    expect(className).toContain(
      styles.skeletonVariants({ shape: 'block', size: 'xl', width: 'xs' }),
    );
    expect(className).not.toContain(styles.skeletonVariants());
  });

  it('holds still for viewers who prefer reduced motion', () => {
    const { container } = render(<Skeleton />);
    expect(container.firstElementChild!.className).toContain(
      styles.skeletonVariants.classNames.base,
    );
  });
});

describe('circle', () => {
  it("defaults to the app's avatar size", () => {
    const { container } = render(<Skeleton variants={{ shape: 'circle' }} />);
    expect(container.firstElementChild?.className).toContain(
      styles.skeletonVariants({ shape: 'circle' }),
    );
  });
});
