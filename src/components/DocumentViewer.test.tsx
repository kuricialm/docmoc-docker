import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DocumentViewer from './DocumentViewer';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: null,
  }),
}));

vi.mock('@/hooks/useDocuments', () => ({
  useDocumentHistory: () => ({
    data: [],
    isLoading: false,
    error: null,
  }),
  useDocumentMutations: () => ({
    downloadDocument: vi.fn(),
    toggleShare: { mutate: vi.fn() },
    toggleStar: { mutate: vi.fn() },
  }),
}));

vi.mock('@/hooks/useNotes', () => ({
  useDocumentNote: () => ({ data: null }),
  useNoteMutations: () => ({
    upsertNote: { mutate: vi.fn() },
  }),
}));

vi.mock('@/hooks/useDocumentSummary', () => ({
  useDocumentSummary: () => ({
    summaryQuery: { data: null, isLoading: false },
    generateSummary: { isPending: false, mutate: vi.fn() },
  }),
}));

vi.mock('@/hooks/useTags', () => ({
  useTags: () => ({ data: [] }),
  useTagMutations: () => ({
    addTagToDocument: { mutate: vi.fn() },
    removeTagFromDocument: { mutate: vi.fn() },
  }),
}));

vi.mock('./DocumentPreview', () => ({
  default: () => <div>Preview</div>,
}));

vi.mock('./DocumentSummaryCard', () => ({
  default: () => <div>Summary</div>,
}));

describe('DocumentViewer', () => {
  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn();

    render(
      <DocumentViewer
        document={{
          id: 'doc-1',
          user_id: 'user-1',
          name: 'Roadmap.pdf',
          file_type: 'application/pdf',
          file_size: 1024,
          storage_path: '/tmp/roadmap.pdf',
          starred: false,
          trashed: false,
          trashed_at: null,
          shared: false,
          share_token: null,
          created_at: '2026-04-18T12:00:00.000Z',
          updated_at: '2026-04-18T12:00:00.000Z',
          tags: [],
        }}
        open
        onClose={onClose}
      />
    );

    const dialog = await screen.findByRole('dialog');
    const overlay = dialog.previousElementSibling as HTMLElement | null;

    expect(overlay).not.toBeNull();

    fireEvent.pointerDown(overlay!);
    fireEvent.mouseDown(overlay!);
    fireEvent.click(overlay!);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });
});
