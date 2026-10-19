import { createContext, useContext } from 'react';

export type CaptureKind = 'task' | 'note';

export interface CaptureContextValue {
  openCapture: (kind?: CaptureKind) => void;
}

export const CaptureContext = createContext<CaptureContextValue>({ openCapture: () => {} });

export const useCapture = () => useContext(CaptureContext);
