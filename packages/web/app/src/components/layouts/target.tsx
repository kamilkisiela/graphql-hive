import { ReactElement } from 'react';

export const TargetLayout = ({ children, ...props }): ReactElement => {
  return (
    <div {...props}>
      {children}
    </div>
  );
};
