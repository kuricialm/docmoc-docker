import { useDraggable } from '@dnd-kit/core';
import type { Document } from '@/hooks/useDocuments';
import { useDocumentDragContext } from '@/contexts/DocumentDragContext';
import { DOCUMENT_DRAG_TYPE, getDocumentDragId } from '@/lib/documentDragDrop';

export function useDocumentDraggable(document: Document) {
  const { enabled } = useDocumentDragContext();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: getDocumentDragId(document.id),
    data: {
      type: DOCUMENT_DRAG_TYPE,
      document,
    },
    disabled: !enabled,
  });

  return {
    dragAttributes: enabled ? attributes : undefined,
    dragListeners: enabled ? listeners : undefined,
    dragRef: setNodeRef,
    dragEnabled: enabled,
    isDragging,
  };
}
