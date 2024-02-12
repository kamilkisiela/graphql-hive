import { ReactElement } from 'react';
import { clsx } from 'clsx';
import * as S from '@radix-ui/react-slider';

export function Slider(props: S.SliderProps): ReactElement {
  return (
    <S.Root aria-label="value" className="relative flex h-5 touch-none items-center" {...props}>
      <S.Track className="relative h-1 w-full grow rounded-full bg-white dark:bg-gray-800">
        <S.Range className="absolute h-full rounded-full bg-white" />
      </S.Track>
      <S.Thumb className={clsx('block size-5 rounded-full bg-white', 'focus-within:ring')} />
    </S.Root>
  );
}
