import { useCallback, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toast as BaseToast } from '@base-ui/react/toast';
import { Button } from '../button/button';

export type ToastVariant = 'default' | 'destructive' | 'success';

export type ToastOptions = {
  title?: ReactNode;
  description?: ReactNode;
  variant?: ToastVariant;
  /**
   * Milliseconds before the toast dismisses itself. Default and success toasts go after 5s;
   * destructive ones stay until closed, since they carry a message worth reading. `0` keeps
   * any toast up.
   */
  duration?: number;
};

const timeoutByVariant: Record<ToastVariant, number> = {
  default: 5000,
  success: 5000,
  destructive: 0,
};

export function useToast() {
  // The manager changes on every toast; add/close don't, which keeps `toast` safe in effect deps.
  const { add, close } = BaseToast.useToastManager();

  const toast = useCallback(
    ({ title, description, variant = 'default', duration }: ToastOptions) => {
      const id = add({
        title,
        description,
        type: variant,
        timeout: duration ?? timeoutByVariant[variant],
        priority: variant === 'destructive' ? 'high' : 'low',
      });
      return { id, dismiss: () => close(id) };
    },
    [add, close],
  );

  return { toast };
}

const iconByVariant: Record<ToastVariant, ReactNode> = {
  default: <Info aria-hidden className="size-4 shrink-0 text-info" />,
  success: <CircleCheck aria-hidden className="size-4 shrink-0 text-success" />,
  destructive: <CircleAlert aria-hidden className="size-4 shrink-0 text-critical" />,
};

const viewportClass = cn(
  'fixed z-[100] [--gap:0.75rem]',
  'inset-x-4 top-4 [--dir:1]',
  'sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:w-[380px] sm:[--dir:-1]',
);

const rootClass = cn(
  'bg-neutral-3 border-line text-fg absolute right-0 w-full select-none rounded-lg border shadow-lg',
  'top-0 origin-top sm:bottom-0 sm:top-auto sm:origin-bottom',
  'z-[calc(1000-var(--toast-index))]',
  'h-[var(--toast-frontmost-height,var(--toast-height))] data-[expanded]:h-[var(--toast-height)]',
  'ease-authentic transition-[transform,opacity,height] duration-300',
  // Bridges the gap to the next toast so the pointer can travel the stack without collapsing it.
  "after:absolute after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
  'after:top-full sm:after:bottom-full sm:after:top-auto',
  '[transform:scale(calc(max(0,1-var(--toast-index)*0.1)))_translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)+var(--toast-index)*20%*var(--dir)))]',
  'data-[expanded]:[transform:translateX(var(--toast-swipe-movement-x))_translateY(calc((var(--toast-offset-y)+var(--toast-index)*var(--gap))*var(--dir)+var(--toast-swipe-movement-y)))]',
  'data-[starting-style]:[transform:translateY(calc(-150%*var(--dir)))] data-[starting-style]:opacity-0',
  'data-[ending-style]:opacity-0 data-[limited]:opacity-0',
  '[&[data-ending-style]:not([data-limited])]:[transform:translateY(calc(-150%*var(--dir)))]',
  '[&[data-ending-style][data-swipe-direction=down]]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]',
  '[&[data-ending-style][data-swipe-direction=up]]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]',
  '[&[data-ending-style][data-swipe-direction=right]]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))]',
  '[&[data-ending-style][data-swipe-direction=left]]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))]',
);

const contentClass = cn(
  'flex items-start gap-3 p-4 pr-11 transition-opacity duration-200',
  'data-[behind]:opacity-0 data-[expanded]:opacity-100',
);

function ToastList() {
  const { toasts } = BaseToast.useToastManager();

  return toasts.map(toast => (
    <BaseToast.Root key={toast.id} toast={toast} className={rootClass}>
      <BaseToast.Content className={contentClass}>
        {iconByVariant[(toast.type as ToastVariant | undefined) ?? 'default']}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <BaseToast.Title className="text-sm font-medium text-fg select-text" />
          <BaseToast.Description className="text-sm text-fg-default select-text" />
        </div>
      </BaseToast.Content>
      <span className="absolute top-2 right-2">
        <BaseToast.Close
          render={
            <Button layout="iconOnly" icon={X} aria-label="Close" variant="ghost" size="icon-sm" />
          }
        />
      </span>
    </BaseToast.Root>
  ));
}

export function ToastProvider({ children }: { children: ReactNode }) {
  return (
    <BaseToast.Provider limit={3}>
      {children}
      <BaseToast.Portal>
        <BaseToast.Viewport className={viewportClass}>
          <ToastList />
        </BaseToast.Viewport>
      </BaseToast.Portal>
    </BaseToast.Provider>
  );
}
