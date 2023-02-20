import { ReactElement } from 'react';

export const ShineBackground = (): ReactElement => {
  return (
    <div
      className="z-[-1] absolute inset-0"
      style={{
        background: `url(/images/bg-top-shine.png) no-repeat left top/468px 278px,
                     url(/images/bg-bottom-shine.png) no-repeat right bottom/330px 399px`,
      }}
    />
  );
};
