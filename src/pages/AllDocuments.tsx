import { useState, useMemo, useEffect } from 'react';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { useTags } from '@/hooks/useTags';
import { useDocumentBrowse } from '@/hooks/useDocumentBrowse';
import DashboardStats from '@/components/DashboardStats';
import DocumentCard from '@/components/DocumentCard';
import DocumentListView from '@/components/DocumentListView';
import DocumentViewer from '@/components/DocumentViewer';
import RenameDialog from '@/components/RenameDialog';
import DocumentBrowseToolbar from '@/components/DocumentBrowseToolbar';
import { FileText } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import * as api from '@/lib/api';
import BulkDocumentToolbar from '@/components/BulkDocumentToolbar';

type Props = {
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  search: string;
  uploadTrigger?: number;
};

export default function AllDocuments({ viewMode, onViewModeChange, search }: Props) {
  const { data: allDocs = [] } = useDocuments({ sortBy: 'created' });
  const { data: trashedDocs = [] } = useDocuments({ trashed: true });
  const { data: tags = [] } = useTags();
  const [viewDocId, setViewDocId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagId, setBulkTagId] = useState('');
  const qc = useQueryClient();

  const {
    dateFilter,
    setDateFilter,
    sortBy,
    setSortBy,
    fileTypeFilter,
    setFileTypeFilter,
    tagFilter,
    setTagFilter,
    page,
    setPage,
    totalPages,
    availableFileTypes,
    filteredDocuments,
    paginatedDocuments,
    resetFilters,
  } = useDocumentBrowse(allDocs, search);

  const viewDoc = useMemo(
    () => allDocs.find((doc) => doc.id === viewDocId) ?? null,
    [allDocs, viewDocId]
  );

  const selectedCount = selectedIds.size;

  const toggleSelect = (doc: Document) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(doc.id)) next.delete(doc.id);
      else next.add(doc.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedDocs = allDocs.filter((doc) => selectedIds.has(doc.id));

  useEffect(() => {
    setSelectedIds((prev) => {
      const live = new Set(allDocs.map((doc) => doc.id));
      const next = new Set<string>();
      for (const id of prev) {
        if (live.has(id)) next.add(id);
      }
      return next;
    });
  }, [allDocs]);

  const bulkDelete = async () => {
    if (selectedDocs.length === 0) return;
    await Promise.all(selectedDocs.map((doc) => api.trashDocument(doc.id)));
    await qc.invalidateQueries({ queryKey: ['documents'] });
    clearSelection();
    toast.success(`Moved ${selectedDocs.length} document(s) to trash`);
  };

  const bulkTag = async () => {
    if (!bulkTagId || selectedDocs.length === 0) return;
    await Promise.all(selectedDocs.map((doc) => api.addTagToDocument(doc.id, bulkTagId)));
    await qc.invalidateQueries({ queryKey: ['documents'] });
    clearSelection();
    setBulkTagId('');
    toast.success(`Tagged ${selectedDocs.length} document(s)`);
  };

  return (
    <div className="space-y-6 animate-page-in">
      <DashboardStats documents={[...allDocs, ...trashedDocs]} />

      <DocumentBrowseToolbar
        viewMode={viewMode}
        onViewModeChange={onViewModeChange}
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        fileTypeFilter={fileTypeFilter}
        onFileTypeFilterChange={setFileTypeFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        availableFileTypes={availableFileTypes}
        tags={tags}
        totalResults={filteredDocuments.length}
        totalBaseResults={allDocs.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onResetFilters={resetFilters}
      />

      {filteredDocuments.length === 0 ? (
        <div className="text-center py-20">
          <FileText className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-muted-foreground text-sm">No matching documents</p>
          <p className="text-xs text-muted-foreground/50 mt-1">Try adjusting search or filters</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {paginatedDocuments.map((doc) => (
            <DocumentCard
              key={doc.id}
              document={doc}
              onView={(selected) => setViewDocId(selected.id)}
              onRename={setRenameDoc}
              selected={selectedIds.has(doc.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      ) : (
        <DocumentListView
          documents={paginatedDocuments}
          onView={(selected) => setViewDocId(selected.id)}
          onRename={setRenameDoc}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
        />
      )}
      <BulkDocumentToolbar
        selectedCount={selectedCount}
        tags={tags}
        bulkTagId={bulkTagId}
        onBulkTagIdChange={setBulkTagId}
        onDelete={bulkDelete}
        onApplyTag={bulkTag}
        onClear={clearSelection}
      />
      <DocumentViewer document={viewDoc} open={!!viewDocId} onClose={() => setViewDocId(null)} />
      <RenameDialog document={renameDoc} open={!!renameDoc} onClose={() => setRenameDoc(null)} />
    </div>
  );
}
