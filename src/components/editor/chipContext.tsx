import { createContext, useContext } from 'react';
import type { ListRow, Task } from '@/data/types';

export interface ChipContextValue {
  tasks: Map<string, Task>;
  lists: Map<string, ListRow>;
  toggle: (taskId: string) => void;
  open: (pageId: string) => void;
}

export const ChipContext = createContext<ChipContextValue>({
  tasks: new Map(),
  lists: new Map(),
  toggle: () => {},
  open: () => {},
});

export const useChips = () => useContext(ChipContext);
