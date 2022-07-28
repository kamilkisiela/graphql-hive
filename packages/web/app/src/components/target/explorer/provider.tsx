import React from 'react';
import { useLocalStorage } from '@/lib/hooks/use-local-storage';

const SchemaExplorerContext = React.createContext<{
  isArgumentListCollapsed: boolean;
  setArgumentListCollapsed(isCollapsed: boolean): void;
}>({
  isArgumentListCollapsed: true,
  setArgumentListCollapsed: () => {},
});

export function SchemaExplorerProvider(props: React.PropsWithChildren<{}>) {
  const [isArgumentListCollapsed, setArgumentListCollapsed] = useLocalStorage('hive:schema-explorer:collapsed', true);

  return (
    <SchemaExplorerContext.Provider value={{ isArgumentListCollapsed, setArgumentListCollapsed }}>
      {props.children}
    </SchemaExplorerContext.Provider>
  );
}

export function useSchemaExplorerContext() {
  return React.useContext(SchemaExplorerContext);
}

export function useArgumentListToggle() {
  const { isArgumentListCollapsed, setArgumentListCollapsed } = useSchemaExplorerContext();
  const toggle = React.useCallback(() => {
    setArgumentListCollapsed(!isArgumentListCollapsed);
  }, [setArgumentListCollapsed, isArgumentListCollapsed]);

  return [isArgumentListCollapsed, toggle] as const;
}
