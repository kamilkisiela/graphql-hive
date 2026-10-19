import { useEffect, useLayoutEffect, useRef } from 'react';
import { format } from 'date-fns';
import { useVirtualizer } from '@tanstack/react-virtual';
import * as styles from './virtual-log-list.css';

export type LogEntry = {
  timestamp: string;
  message: string;
};

const ITEM_HEIGHT = 24;

export function VirtualLogList(props: { logs: LogEntry[]; className?: string }) {
  const { logs } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);

  const virtualizer = useVirtualizer({
    count: logs.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      const { scrollHeight, scrollTop, clientHeight } = scrollEl;
      atBottomRef.current = scrollHeight - scrollTop - clientHeight < ITEM_HEIGHT;
    };

    scrollEl.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, []);

  useLayoutEffect(() => {
    if (atBottomRef.current && logs.length > 0) {
      virtualizer.scrollToIndex(logs.length - 1, { behavior: 'smooth', align: 'end' });
    }
  }, [logs.length, virtualizer]);

  return (
    <div ref={scrollRef} className={props.className} style={{ overflow: 'auto' }}>
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
        {virtualizer.getVirtualItems().map(virtualItem => {
          const logRow = logs[virtualItem.index];
          return (
            <div
              key={virtualItem.index}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: virtualItem.size,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <div className={styles.virtualLogListDiv}>
                <time dateTime={logRow.timestamp} className={styles.virtualLogListTime}>
                  {format(logRow.timestamp, 'HH:mm:ss')}
                </time>
                {logRow.message}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
