import { createContext, useContext } from 'react';
import { GripVertical } from 'lucide-react';
import { Group, Panel, Separator } from 'react-resizable-panels';
import { cn } from '@/lib/utils';
import * as styles from './resizable.css';

type Orientation = NonNullable<React.ComponentProps<typeof Group>['orientation']>;

// v4 exposes the orientation only as aria-orientation on the separator, so the group shares it
// with the handle for the vertical-layout styles below.
const OrientationContext = createContext<Orientation>('horizontal');

const ResizablePanelGroup = ({
  className,
  orientation = 'horizontal',
  ...props
}: React.ComponentProps<typeof Group>) => (
  <OrientationContext.Provider value={orientation}>
    <Group
      orientation={orientation}
      data-orientation={orientation}
      className={cn(styles.resizablePanelGroupGroup, className)}
      {...props}
    />
  </OrientationContext.Provider>
);

const ResizablePanel = Panel;

const ResizableHandle = ({
  withHandle,
  className,
  ...props
}: React.ComponentProps<typeof Separator> & {
  withHandle?: boolean;
}) => {
  const orientation = useContext(OrientationContext);
  return (
    <Separator
      data-orientation={orientation}
      className={cn(styles.resizableHandleSeparator, className)}
      {...props}
    >
      {withHandle && (
        <div className={styles.resizableHandleDiv}>
          <GripVertical className={styles.resizableHandleGripVertical} />
        </div>
      )}
    </Separator>
  );
};

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
