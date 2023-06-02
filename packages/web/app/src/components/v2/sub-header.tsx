import { ReactElement, ReactNode } from 'react';

export const SubHeader = ({ children = null }: { children?: ReactNode }): ReactElement => {
  return (
    <header
      className={`
        after:z-[-1]
        relative
        after:absolute
        after:inset-x-0
        after:top-0
        after:bottom-[-46px]
        after:content-['']
      `}
    >
      <style jsx>{`
        header::after {
          background: url(/images/bg-top-shine.svg) no-repeat top left;
          transform: scaleX(-1);
        }
      `}</style>

      {children}
    </header>
  );
};
