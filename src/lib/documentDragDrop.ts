import type { ClientRect, CollisionDescriptor, CollisionDetection, Modifier, UniqueIdentifier } from '@dnd-kit/core';
import type { Transform } from '@dnd-kit/utilities';
import type { Document } from '@/hooks/useDocuments';

export const DOCUMENT_DRAG_TYPE = 'document';
export const SIDEBAR_STARRED_DROP_TARGET_ID = 'sidebar:starred';
export const SIDEBAR_TRASH_DROP_TARGET_ID = 'sidebar:trash';
export const DOCUMENT_DRAG_PREVIEW_WIDTH = 220;
export const DOCUMENT_DRAG_PREVIEW_HEIGHT = 120;

const DOCUMENT_DRAG_ID_PREFIX = 'document:';
const SIDEBAR_TAG_DROP_TARGET_PREFIX = 'sidebar:tag:';
const SIDEBAR_DROP_COLLISION_RIGHT_EXPANSION = 10;
const SIDEBAR_DROP_COLLISION_VERTICAL_EXPANSION = 2;

export type DragDocument = Pick<Document, 'id' | 'name' | 'file_type' | 'file_size' | 'starred' | 'tags'>;

export type DragDocumentData = {
  type: typeof DOCUMENT_DRAG_TYPE;
  document: DragDocument;
};

type RectLike = {
  left: number;
  top: number;
  width: number;
  height: number;
};

type ClientPoint = {
  clientX: number;
  clientY: number;
};

type SidebarDropCollisionSortData = {
  value: number;
  dragVerticalGap: number;
  dragCenterDistance: number;
};

export type DocumentDragGrabOffset = {
  xRatio: number;
  yRatio: number;
};

export type DocumentDropAction =
  | { kind: 'starred' }
  | { kind: 'trash' }
  | { kind: 'tag'; tagId: string }
  | { kind: 'noop'; reason: 'already-starred' | 'already-tagged' };

export type PreserveDocumentDragGrabPointTransformArgs = {
  activatorEvent?: unknown;
  activeNodeRect?: RectLike | null;
  overlayNodeRect?: RectLike | null;
  transform: Transform;
};

export function getDocumentDragId(documentId: string) {
  return `${DOCUMENT_DRAG_ID_PREFIX}${documentId}`;
}

export function getTagDropTargetId(tagId: string) {
  return `${SIDEBAR_TAG_DROP_TARGET_PREFIX}${tagId}`;
}

export function getDraggedDocument(data: unknown): DragDocument | null {
  if (!data || typeof data !== 'object') return null;
  const candidate = data as Partial<DragDocumentData>;
  if (candidate.type !== DOCUMENT_DRAG_TYPE || !candidate.document) return null;
  return candidate.document;
}

export function isSidebarDocumentDropTarget(id: UniqueIdentifier | null | undefined) {
  if (!id) return false;
  const normalizedId = String(id);
  return normalizedId === SIDEBAR_STARRED_DROP_TARGET_ID
    || normalizedId === SIDEBAR_TRASH_DROP_TARGET_ID
    || Boolean(parseTagDropTargetId(normalizedId));
}

export function adjustSidebarDropCollisionRect(rect: ClientRect, id: UniqueIdentifier): ClientRect {
  if (!isSidebarDocumentDropTarget(id)) {
    return rect;
  }

  return {
    ...rect,
    top: rect.top - SIDEBAR_DROP_COLLISION_VERTICAL_EXPANSION,
    right: rect.right + SIDEBAR_DROP_COLLISION_RIGHT_EXPANSION,
    bottom: rect.bottom + SIDEBAR_DROP_COLLISION_VERTICAL_EXPANSION,
    width: rect.width + SIDEBAR_DROP_COLLISION_RIGHT_EXPANSION,
    height: rect.height + SIDEBAR_DROP_COLLISION_VERTICAL_EXPANSION * 2,
  };
}

function getIntersectionRatio(entry: ClientRect, target: ClientRect) {
  const top = Math.max(target.top, entry.top);
  const left = Math.max(target.left, entry.left);
  const right = Math.min(target.right, entry.right);
  const bottom = Math.min(target.bottom, entry.bottom);
  const width = right - left;
  const height = bottom - top;

  if (left < right && top < bottom) {
    const targetArea = target.width * target.height;
    const entryArea = entry.width * entry.height;
    const intersectionArea = width * height;
    const intersectionRatio = intersectionArea / (targetArea + entryArea - intersectionArea);
    return Number(intersectionRatio.toFixed(4));
  }

  return 0;
}

export function getSidebarDropCollisionSortData(
  collisionRect: ClientRect,
  rect: ClientRect,
  value: number,
): SidebarDropCollisionSortData {
  const collisionRectCenterY = collisionRect.top + collisionRect.height / 2;
  const dragVerticalGap = collisionRect.bottom < rect.top
    ? rect.top - collisionRect.bottom
    : collisionRect.top > rect.bottom
      ? collisionRect.top - rect.bottom
      : 0;

  return {
    value,
    dragVerticalGap,
    dragCenterDistance: Math.abs(collisionRectCenterY - (rect.top + rect.height / 2)),
  };
}

export function compareSidebarDropCollisionSortData(
  a: SidebarDropCollisionSortData,
  b: SidebarDropCollisionSortData,
) {
  if (a.dragVerticalGap !== b.dragVerticalGap) {
    return a.dragVerticalGap - b.dragVerticalGap;
  }

  if (a.dragCenterDistance !== b.dragCenterDistance) {
    return a.dragCenterDistance - b.dragCenterDistance;
  }

  return b.value - a.value;
}
function clampRatio(value: number) {
  return Math.min(1, Math.max(0, value));
}

export function getDocumentDragGrabOffset(
  activatorEvent: unknown,
  activeNodeRect: RectLike | null | undefined,
): DocumentDragGrabOffset | null {
  const clientPoint = getActivatorClientCoordinates(activatorEvent);

  if (!clientPoint || !hasUsableRect(activeNodeRect)) {
    return null;
  }

  return {
    xRatio: clampRatio((clientPoint.clientX - activeNodeRect.left) / activeNodeRect.width),
    yRatio: clampRatio((clientPoint.clientY - activeNodeRect.top) / activeNodeRect.height),
  };
}

export function getDocumentDragPreviewCollisionRect(
  pointerCoordinates: { x: number; y: number } | null,
  grabOffset: DocumentDragGrabOffset | null,
): ClientRect | null {
  if (!pointerCoordinates || !grabOffset) {
    return null;
  }

  const left = pointerCoordinates.x - grabOffset.xRatio * DOCUMENT_DRAG_PREVIEW_WIDTH;
  const top = pointerCoordinates.y - grabOffset.yRatio * DOCUMENT_DRAG_PREVIEW_HEIGHT;

  return {
    left,
    top,
    width: DOCUMENT_DRAG_PREVIEW_WIDTH,
    height: DOCUMENT_DRAG_PREVIEW_HEIGHT,
    right: left + DOCUMENT_DRAG_PREVIEW_WIDTH,
    bottom: top + DOCUMENT_DRAG_PREVIEW_HEIGHT,
  };
}

export function resolveSidebarDocumentDropCollisions({
  collisionRect,
  droppableRects,
  droppableContainers,
  pointerCoordinates,
}: Parameters<CollisionDetection>[0], grabOffset: DocumentDragGrabOffset | null = null) {
  const effectiveCollisionRect = getDocumentDragPreviewCollisionRect(pointerCoordinates, grabOffset) ?? collisionRect;
  const collisions: CollisionDescriptor[] = [];

  for (const droppableContainer of droppableContainers) {
    const rect = droppableRects.get(droppableContainer.id);
    if (!rect) continue;

    const adjustedRect = adjustSidebarDropCollisionRect(rect, droppableContainer.id);
    const value = getIntersectionRatio(effectiveCollisionRect, adjustedRect);

    if (value > 0) {
      const sortData = getSidebarDropCollisionSortData(effectiveCollisionRect, adjustedRect, value);
      collisions.push({
        id: droppableContainer.id,
        data: {
          droppableContainer,
          ...sortData,
        },
      });
    }
  }

  return collisions.sort((a, b) => compareSidebarDropCollisionSortData(a.data as SidebarDropCollisionSortData, b.data as SidebarDropCollisionSortData));
};

export const sidebarDocumentDropCollisionDetection: CollisionDetection = (args) => resolveSidebarDocumentDropCollisions(args);

function isClientPoint(value: unknown): value is ClientPoint {
  return Boolean(
    value
    && typeof value === 'object'
    && 'clientX' in value
    && 'clientY' in value
    && typeof (value as ClientPoint).clientX === 'number'
    && typeof (value as ClientPoint).clientY === 'number',
  );
}

function getFirstTouchPoint(value: unknown): ClientPoint | null {
  if (!value || typeof value !== 'object' || !('length' in value)) return null;
  const firstTouch = (value as ArrayLike<unknown>)[0];
  return isClientPoint(firstTouch) ? firstTouch : null;
}

function getActivatorClientCoordinates(activatorEvent: unknown): ClientPoint | null {
  if (isClientPoint(activatorEvent)) {
    return activatorEvent;
  }

  if (!activatorEvent || typeof activatorEvent !== 'object') {
    return null;
  }

  const eventCandidate = activatorEvent as {
    touches?: unknown;
    changedTouches?: unknown;
    clientX?: unknown;
    clientY?: unknown;
  };

  return getFirstTouchPoint(eventCandidate.touches)
    ?? getFirstTouchPoint(eventCandidate.changedTouches)
    ?? (isClientPoint(eventCandidate) ? eventCandidate : null);
}

function hasUsableRect(rect: RectLike | null | undefined): rect is RectLike {
  return Boolean(
    rect
    && Number.isFinite(rect.left)
    && Number.isFinite(rect.top)
    && Number.isFinite(rect.width)
    && Number.isFinite(rect.height)
    && rect.width > 0
    && rect.height > 0,
  );
}

export function preserveDocumentDragGrabPointTransform({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}: PreserveDocumentDragGrabPointTransformArgs): Transform {
  const grabOffset = getDocumentDragGrabOffset(activatorEvent, activeNodeRect);

  if (!grabOffset || !hasUsableRect(activeNodeRect) || !hasUsableRect(overlayNodeRect)) {
    return transform;
  }

  const initialPointerOffsetX = grabOffset.xRatio * activeNodeRect.width;
  const initialPointerOffsetY = grabOffset.yRatio * activeNodeRect.height;
  const overlayPointerOffsetX = grabOffset.xRatio * overlayNodeRect.width;
  const overlayPointerOffsetY = grabOffset.yRatio * overlayNodeRect.height;

  return {
    ...transform,
    x: transform.x + initialPointerOffsetX - overlayPointerOffsetX,
    y: transform.y + initialPointerOffsetY - overlayPointerOffsetY,
  };
}

export const preserveDocumentDragGrabPoint: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => preserveDocumentDragGrabPointTransform({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
});

export function parseTagDropTargetId(id: UniqueIdentifier | null | undefined) {
  if (!id) return null;
  const normalizedId = String(id);
  if (!normalizedId.startsWith(SIDEBAR_TAG_DROP_TARGET_PREFIX)) return null;
  return normalizedId.slice(SIDEBAR_TAG_DROP_TARGET_PREFIX.length);
}

export function resolveDocumentDropAction(
  document: DragDocument,
  overId: UniqueIdentifier | null | undefined,
): DocumentDropAction | null {
  const normalizedId = overId ? String(overId) : null;
  if (!normalizedId) return null;

  if (normalizedId === SIDEBAR_STARRED_DROP_TARGET_ID) {
    return document.starred ? { kind: 'noop', reason: 'already-starred' } : { kind: 'starred' };
  }

  if (normalizedId === SIDEBAR_TRASH_DROP_TARGET_ID) {
    return { kind: 'trash' };
  }

  const tagId = parseTagDropTargetId(normalizedId);
  if (!tagId) return null;

  const alreadyTagged = (document.tags || []).some((tag) => tag.id === tagId);
  if (alreadyTagged) {
    return { kind: 'noop', reason: 'already-tagged' };
  }

  return { kind: 'tag', tagId };
}
