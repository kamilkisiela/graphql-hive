import { useCallback, type ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toast as BaseToast } from '@base-ui/react/toast';
import { Button } from '../button/button';
import * as styles from './toast.css';

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
  default: <Info aria-hidden className={styles.info} />,
  success: <CircleCheck aria-hidden className={styles.circleCheck} />,
  destructive: <CircleAlert aria-hidden className={styles.circleAlert} />,
};

const viewportClass = cn(styles.class2, styles.class3, styles.class4);

const rootClass = cn(
  styles.class5,
  styles.class6,
  styles.class7,
  styles.class8,
  styles.class9,
  // Bridges the gap to the next toast so the pointer can travel the stack without collapsing it.
  styles.class10,
  styles.class11,
  styles.class12,
  styles.class13,
  styles.class14,
  styles.class15,
  styles.class16,
  styles.class17,
  styles.class18,
  styles.class19,
  styles.class20,
);

const contentClass = cn(styles.class21, styles.class22);

function ToastList() {
  const { toasts } = BaseToast.useToastManager();

  return toasts.map(toast => (
    <BaseToast.Root key={toast.id} toast={toast} className={rootClass}>
      <BaseToast.Content className={contentClass}>
        {iconByVariant[(toast.type as ToastVariant | undefined) ?? 'default']}
        <div className={styles.toastListDiv}>
          <BaseToast.Title className={styles.toastListTitle} />
          <BaseToast.Description className={styles.toastListDescription} />
        </div>
      </BaseToast.Content>
      <span className={styles.toastListSpan}>
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
