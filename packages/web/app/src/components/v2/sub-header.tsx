import { FC, ReactElement, ReactNode } from 'react';

export const SubHeader: FC = ({ children }: { children: ReactNode }): ReactElement => {
  return (
    <header
      className={`
        after:-z-1
        relative
        pt-20
        after:absolute
        after:inset-x-0
        after:top-0
        after:bottom-[-46px]
        after:border-b
        after:border-gray-800
        after:content-['']
      `}
    >
      <style jsx>{`
        header::after {
          background: url(/images/bg-top-shine.svg) no-repeat left top,
            url(/images/bg-bottom-shine.svg) no-repeat right bottom;
        }
      `}</style>

      {children}
    </header>
  );
};
