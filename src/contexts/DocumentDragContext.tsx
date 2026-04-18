import { createContext, useContext } from 'react';
import type { DragDocument } from '@/lib/documentDragDrop';

type DocumentDragContextValue = {
  enabled: boolean;
  activeDocument: DragDocument | null;
  activeTargetId: string | null;
};

const DocumentDragContext = createContext<DocumentDragContextValue>({
  enabled: false,
  activeDocument: null,
  activeTargetId: null,
});

export function useDocumentDragContext() {
  return useContext(DocumentDragContext);
}

export const DocumentDragProvider = DocumentDragContext.Provider;
