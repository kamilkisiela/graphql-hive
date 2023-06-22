import { ComponentProps, ReactElement, ReactNode, useContext } from 'react';
import { clsx } from 'clsx';
import * as T from '@radix-ui/react-tooltip';
import { ModalTooltipContext } from './modal';

function Wrapper({
  children,
  content,
  contentProps = {},
}: {
  children: ReactNode;
  content: ReactNode;
  contentProps?: ComponentProps<typeof T.Content>;
}): ReactElement {
  const container = useContext(ModalTooltipContext);
  const innerContent = (
    <T.Content
      sideOffset={4}
      {...contentProps}
      className={clsx(
        'radix-side-top:animate-slide-down-fade',
        'radix-side-right:animate-slide-left-fade',
        'radix-side-bottom:animate-slide-up-fade',
        'radix-side-left:animate-slide-right-fade',
        'rounded-lg bg-gray-800 p-4 text-xs font-normal text-white shadow',
        contentProps.className,
      )}
    >
      <T.Arrow className="fill-current text-black" />
      {content}
    </T.Content>
  );

  return (
    <T.Provider>
      <T.Root>
        <T.Trigger asChild>{children}</T.Trigger>
        {container ? <T.Portal container={container}>{innerContent}</T.Portal> : innerContent}
      </T.Root>
    </T.Provider>
  );
}

export const Tooltip = Object.assign(Wrapper, { Provider: T.Provider });
