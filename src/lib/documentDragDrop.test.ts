import { describe, expect, it } from 'vitest';
import {
  adjustSidebarDropCollisionRect,
  compareSidebarDropCollisionSortData,
  getTagDropTargetId,
  getSidebarDropCollisionSortData,
  isSidebarDocumentDropTarget,
  preserveDocumentDragGrabPointTransform,
  resolveDocumentDropAction,
  SIDEBAR_STARRED_DROP_TARGET_ID,
  SIDEBAR_TRASH_DROP_TARGET_ID,
} from './documentDragDrop';

const baseDocument = {
  id: 'doc-1',
  name: 'Quarterly Report',
  file_type: 'application/pdf',
  file_size: 1024,
  starred: false,
  tags: [],
} as const;

const baseTransform = {
  x: 48,
  y: 72,
  scaleX: 1,
  scaleY: 1,
};

describe('resolveDocumentDropAction', () => {
  it('returns a star action for unstarred documents dropped on Starred', () => {
    expect(resolveDocumentDropAction(baseDocument, SIDEBAR_STARRED_DROP_TARGET_ID)).toEqual({ kind: 'starred' });
  });

  it('returns a noop for documents that are already starred', () => {
    expect(resolveDocumentDropAction({ ...baseDocument, starred: true }, SIDEBAR_STARRED_DROP_TARGET_ID)).toEqual({
      kind: 'noop',
      reason: 'already-starred',
    });
  });

  it('returns tag actions and tag noops correctly', () => {
    const targetId = getTagDropTargetId('tag-7');

    expect(resolveDocumentDropAction(baseDocument, targetId)).toEqual({
      kind: 'tag',
      tagId: 'tag-7',
    });

    expect(resolveDocumentDropAction({
      ...baseDocument,
      tags: [{ id: 'tag-7', name: 'Finance', color: '#2563EB' }],
    }, targetId)).toEqual({
      kind: 'noop',
      reason: 'already-tagged',
    });
  });

  it('returns trash actions for Trash and null for unknown targets', () => {
    expect(resolveDocumentDropAction(baseDocument, SIDEBAR_TRASH_DROP_TARGET_ID)).toEqual({ kind: 'trash' });
    expect(resolveDocumentDropAction(baseDocument, 'sidebar:unknown')).toBeNull();
  });
});

describe('sidebar drop collision helpers', () => {
  it('recognizes the supported sidebar document targets', () => {
    expect(isSidebarDocumentDropTarget(SIDEBAR_STARRED_DROP_TARGET_ID)).toBe(true);
    expect(isSidebarDocumentDropTarget(SIDEBAR_TRASH_DROP_TARGET_ID)).toBe(true);
    expect(isSidebarDocumentDropTarget(getTagDropTargetId('tag-7'))).toBe(true);
    expect(isSidebarDocumentDropTarget('sidebar:unknown')).toBe(false);
  });

  it('only expands sidebar targets on the approach side with a small vertical allowance', () => {
    expect(adjustSidebarDropCollisionRect({
      left: 20,
      top: 100,
      right: 203,
      bottom: 134,
      width: 183,
      height: 34,
    }, SIDEBAR_STARRED_DROP_TARGET_ID)).toEqual({
      left: 20,
      top: 98,
      right: 213,
      bottom: 136,
      width: 193,
      height: 38,
    });
  });

  it('prefers the target whose vertical band is nearest to the pointer when rows overlap', () => {
    const collisionRect = {
      left: -100,
      top: 120,
      right: 120,
      bottom: 240,
      width: 220,
      height: 120,
    };

    const upperTarget = getSidebarDropCollisionSortData(collisionRect, {
      left: 20,
      top: 100,
      right: 213,
      bottom: 136,
      width: 193,
      height: 36,
    }, 0.19);

    const lowerTarget = getSidebarDropCollisionSortData(collisionRect, {
      left: 20,
      top: 164,
      right: 213,
      bottom: 200,
      width: 193,
      height: 36,
    }, 0.11);

    expect(compareSidebarDropCollisionSortData(upperTarget, lowerTarget)).toBeGreaterThan(0);
    expect(compareSidebarDropCollisionSortData(lowerTarget, upperTarget)).toBeLessThan(0);
  });

  it('falls back to overlap value when the drag rectangle is equally aligned', () => {
    expect(getSidebarDropCollisionSortData({
      left: -100,
      top: 120,
      right: 120,
      bottom: 240,
      width: 220,
      height: 120,
    }, {
      left: 20,
      top: 100,
      right: 213,
      bottom: 136,
      width: 193,
      height: 36,
    }, 0.19)).toEqual({
      value: 0.19,
      dragVerticalGap: 0,
      dragCenterDistance: 62,
    });
  });
});

describe('preserveDocumentDragGrabPointTransform', () => {
  it('keeps the pointer in the same proportional spot for a centered grab', () => {
    expect(preserveDocumentDragGrabPointTransform({
      activatorEvent: { clientX: 260, clientY: 220 },
      activeNodeRect: { left: 200, top: 160, width: 120, height: 120 },
      overlayNodeRect: { left: 0, top: 0, width: 220, height: 120 },
      transform: baseTransform,
    })).toEqual({
      x: -2,
      y: 72,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('keeps a corner grab anchored to the same corner on a smaller overlay', () => {
    expect(preserveDocumentDragGrabPointTransform({
      activatorEvent: { clientX: 212, clientY: 170 },
      activeNodeRect: { left: 200, top: 160, width: 120, height: 120 },
      overlayNodeRect: { left: 0, top: 0, width: 220, height: 120 },
      transform: baseTransform,
    })).toEqual({
      x: 38,
      y: 72,
      scaleX: 1,
      scaleY: 1,
    });
  });

  it('returns the original transform when the measurements are missing', () => {
    expect(preserveDocumentDragGrabPointTransform({
      activatorEvent: null,
      activeNodeRect: { left: 200, top: 160, width: 120, height: 120 },
      overlayNodeRect: null,
      transform: baseTransform,
    })).toEqual(baseTransform);
  });
});
