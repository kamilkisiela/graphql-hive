import { useCallback, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { LaboratoryEnv } from './env';
import type { LaboratoryHistoryRequest } from './history';
import type { LaboratoryOperation } from './operations';
import type { LaboratoryPreflight } from './preflight';
import type { LaboratoryTest } from './tests';

export interface LaboratoryTabOperation {
  id: string;
  type: 'operation';
  data: Pick<LaboratoryOperation, 'id' | 'name'>;
  readOnly?: boolean;
}

export interface LaboratoryTabHistory {
  id: string;
  type: 'history';
  data: Pick<LaboratoryHistoryRequest, 'id'>;
  readOnly?: boolean;
}

export interface LaboratoryTabPreflight {
  id: string;
  type: 'preflight';
  data: LaboratoryPreflight;
  readOnly?: boolean;
}

export interface LaboratoryTabEnv {
  id: string;
  type: 'env';
  data: LaboratoryEnv;
  readOnly?: boolean;
}

export interface LaboratoryTabTest {
  id: string;
  type: 'test';
  data: Pick<LaboratoryTest, 'id' | 'name'>;
  readOnly?: boolean;
}

export interface LaboratoryTabSettings {
  id: string;
  type: 'settings';
  data: unknown;
  readOnly?: boolean;
}

export interface LaboratoryTabCustom {
  id: string;
  type: string;
  data: unknown;
  readOnly?: boolean;
}

export type LaboratoryTabData =
  | Pick<LaboratoryOperation, 'id' | 'name'>
  | Pick<LaboratoryHistoryRequest, 'id'>
  | LaboratoryPreflight
  | LaboratoryEnv;

export type LaboratoryTab =
  | LaboratoryTabOperation
  | LaboratoryTabPreflight
  | LaboratoryTabEnv
  | LaboratoryTabHistory
  | LaboratoryTabSettings
  | LaboratoryTabTest
  | LaboratoryTabCustom;

export interface LaboratoryTabsState {
  tabs: LaboratoryTab[];
}

export interface LaboratoryTabsActions {
  activeTab: LaboratoryTab | null;
  setActiveTab: (tab: LaboratoryTab) => void;
  setTabs: (tabs: LaboratoryTab[]) => void;
  addTab: (tab: Omit<LaboratoryTab, 'id'>) => LaboratoryTab;
  updateTab: (id: string, data: LaboratoryTabData) => void;
  deleteTab: (tabId: string) => void;
  /** Points operation tabs at an operation's persisted id. */
  replaceOperationId: (previousId: string, id: string) => void;
}

export const useTabs = (props: {
  defaultTabs?: LaboratoryTab[] | null;
  defaultActiveTabId?: string | null;
  onTabsChange?: (tabs: LaboratoryTab[]) => void;
  onActiveTabIdChange?: (tabId: string | null) => void;
}): LaboratoryTabsState & LaboratoryTabsActions => {
  const [tabs, _setTabs] = useState<LaboratoryTab[]>(props.defaultTabs ?? []);

  const [activeTab, _setActiveTab] = useState<LaboratoryTab | null>(
    props.defaultTabs?.find(t => t.id === props.defaultActiveTabId) ??
      props.defaultTabs?.[0] ??
      null,
  );

  // Persisted ids arrive after the fact, so the rename reads the latest state, not a closure.
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const setActiveTab = useCallback(
    (tab: LaboratoryTab) => {
      _setActiveTab(tab);
      props.onActiveTabIdChange?.(tab?.id ?? null);
    },
    [props],
  );

  const setTabs = useCallback(
    (tabs: LaboratoryTab[]) => {
      _setTabs(tabs);
      props.onTabsChange?.(tabs);
    },
    [props],
  );

  const addTab = useCallback(
    (tab: Omit<LaboratoryTab, 'id'>) => {
      const newTab = { ...tab, id: uuidv4() } as LaboratoryTab;
      const newTabs = [...(tabs ?? []), newTab] as LaboratoryTab[];
      _setTabs(newTabs);
      props.onTabsChange?.(newTabs);

      return newTab;
    },
    [tabs, props],
  );

  const deleteTab = useCallback(
    (tabId: string) => {
      const newTabs = tabs.filter(t => t.id !== tabId);
      _setTabs(newTabs);
      props.onTabsChange?.(newTabs);
    },
    [tabs, props],
  );

  const updateTab = useCallback(
    (id: string, newData: LaboratoryTabData) => {
      const newTabs = tabs.map(t => (t.id === id ? { ...t, data: newData } : t)) as LaboratoryTab[];
      _setTabs(newTabs);
      props.onTabsChange?.(newTabs);
    },
    [tabs, props],
  );

  const replaceOperationId = useCallback(
    (previousId: string, id: string) => {
      const isOperationTab = (tab: LaboratoryTab): tab is LaboratoryTabOperation =>
        tab.type === 'operation';
      const follow = (tab: LaboratoryTab): LaboratoryTab =>
        isOperationTab(tab) && tab.data.id === previousId
          ? { ...tab, data: { ...tab.data, id } }
          : tab;

      const newTabs = tabsRef.current.map(follow);
      _setTabs(newTabs);
      props.onTabsChange?.(newTabs);

      if (activeTabRef.current) {
        _setActiveTab(follow(activeTabRef.current));
      }
    },
    [props],
  );

  return {
    activeTab,
    setActiveTab,
    tabs,
    setTabs,
    addTab,
    deleteTab,
    updateTab,
    replaceOperationId,
  };
};
