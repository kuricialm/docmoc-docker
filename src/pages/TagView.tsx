import { useMemo, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useDocuments, Document } from '@/hooks/useDocuments';
import { useTags, useTagMutations } from '@/hooks/useTags';
import { useDocumentBrowse } from '@/hooks/useDocumentBrowse';
import DocumentCard from '@/components/DocumentCard';
import DocumentListView from '@/components/DocumentListView';
import DocumentViewer from '@/components/DocumentViewer';
import RenameDialog from '@/components/RenameDialog';
import DocumentBrowseToolbar from '@/components/DocumentBrowseToolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Trash2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import * as api from '@/lib/api';
import BulkDocumentToolbar from '@/components/BulkDocumentToolbar';

type Props = { viewMode: 'grid' | 'list'; onViewModeChange: (mode: 'grid' | 'list') => void; search: string };

export default function TagView({ viewMode, onViewModeChange, search }: Props) {
  const { tagId } = useParams<{ tagId: string }>();
  const { data: tags = [] } = useTags();
  const { data: docs = [] } = useDocuments({ tagId });
  const { updateTag, deleteTag } = useTagMutations();
  const [viewDocId, setViewDocId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTagId, setBulkTagId] = useState('');
  const qc = useQueryClient();

  const tag = tags.find((t) => t.id === tagId);

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
  } = useDocumentBrowse(docs, search, { lockedTagId: tagId });

  const viewDoc = useMemo(() => docs.find((doc) => doc.id === viewDocId) ?? null, [docs, viewDocId]);
  const selectedDocs = docs.filter((doc) => selectedIds.has(doc.id));

  useEffect(() => {
    setSelectedIds((prev) => new Set([...prev].filter((id) => docs.some((doc) => doc.id === id))));
  }, [docs]);

  if (!tag) return <p className="text-muted-foreground text-center py-20">Tag not found</p>;

  const handleSave = () => {
    if (editName.trim()) {
      updateTag.mutate({ id: tag.id, name: editName.trim(), color: tag.color });
    }
    setEditing(false);
  };

  const handleDelete = () => {
    deleteTag.mutate(tag.id);
    toast.success('Tag deleted');
  };

  const toggleSelect = (doc: Document) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(doc.id)) next.delete(doc.id);
      else next.add(doc.id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

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
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
        {editing ? (
          <div className="flex items-center gap-2">
            <Input value={editName} onChange={(e) => setEditName(e.target.value)} className="h-8 w-48" autoFocus />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={handleSave}><Check className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(false)}><X className="w-3.5 h-3.5" /></Button>
          </div>
        ) : (
          <>
            <h2 className="text-lg font-semibold">{tag.name}</h2>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditing(true); setEditName(tag.name); }}><Edit2 className="w-3.5 h-3.5" /></Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={handleDelete}><Trash2 className="w-3.5 h-3.5" /></Button>
          </>
        )}
      </div>

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
        totalBaseResults={docs.length}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        onResetFilters={resetFilters}
        lockTagFilter
      />

      {filteredDocuments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-20">No matching documents with this tag</p>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
        selectedCount={selectedIds.size}
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
