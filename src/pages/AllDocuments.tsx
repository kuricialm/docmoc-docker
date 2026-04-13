import { useState, useRef, useCallback, useMemo } from 'react';
import { useDocuments, useDocumentMutations, Document } from '@/hooks/useDocuments';
import { useTags } from '@/hooks/useTags';
import { useDocumentBrowse } from '@/hooks/useDocumentBrowse';
import DashboardStats from '@/components/DashboardStats';
import DocumentCard from '@/components/DocumentCard';
import DocumentListView from '@/components/DocumentListView';
import DocumentViewer from '@/components/DocumentViewer';
import RenameDialog from '@/components/RenameDialog';
import DocumentBrowseToolbar from '@/components/DocumentBrowseToolbar';
import { FileText } from 'lucide-react';
import { toast } from 'sonner';
import { ACCEPTED_UPLOAD_ATTR, isAcceptedUploadFile } from '@/lib/fileTypes';

type Props = {
  viewMode: 'grid' | 'list';
  search: string;
  uploadTrigger: number;
};

export default function AllDocuments({ viewMode, search }: Props) {
  const { data: allDocs = [] } = useDocuments({ sortBy: 'created' });
  const { data: trashedDocs = [] } = useDocuments({ trashed: true });
  const { data: tags = [] } = useTags();
  const { uploadDocument } = useDocumentMutations();
  const [viewDocId, setViewDocId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const dragDepthRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    dateFilter,
    setDateFilter,
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

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const acceptedFiles = Array.from(files).filter((file) => isAcceptedUploadFile(file));
    const rejectedCount = files.length - acceptedFiles.length;

    acceptedFiles.forEach((file) => uploadDocument.mutate(file));
    if (rejectedCount > 0) {
      toast.error(`${rejectedCount} file${rejectedCount > 1 ? 's were' : ' was'} skipped (unsupported format).`);
    }

    e.target.value = '';
  }, [uploadDocument]);

  const resetDragState = useCallback(() => {
    dragDepthRef.current = 0;
    setIsDraggingFiles(false);
  }, []);

  const hasFileDrag = useCallback((event: React.DragEvent<HTMLElement>) => {
    return Array.from(event.dataTransfer.types).includes('Files');
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current += 1;
    setIsDraggingFiles(true);
  }, [hasFileDrag]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
  }, [hasFileDrag]);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    dragDepthRef.current -= 1;
    if (dragDepthRef.current <= 0) {
      resetDragState();
    }
  }, [hasFileDrag, resetDragState]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLElement>) => {
    if (!hasFileDrag(event)) return;
    event.preventDefault();
    event.stopPropagation();
    resetDragState();

    const files = Array.from(event.dataTransfer.files);
    if (!files.length) return;

    const acceptedFiles = files.filter((file) => isAcceptedUploadFile(file));
    const rejectedCount = files.length - acceptedFiles.length;
    acceptedFiles.forEach((file) => uploadDocument.mutate(file));

    if (rejectedCount > 0) {
      toast.error(`${rejectedCount} file${rejectedCount > 1 ? 's were' : ' was'} skipped (unsupported format).`);
    }
  }, [hasFileDrag, resetDragState, uploadDocument]);

  return (
    <div
      className={`relative space-y-6 animate-page-in transition-colors duration-200 ${
        isDraggingFiles ? 'rounded-xl bg-primary/5 ring-2 ring-primary/30 ring-offset-2 ring-offset-background' : ''
      }`}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <input ref={fileInputRef} type="file" accept={ACCEPTED_UPLOAD_ATTR} multiple className="hidden" onChange={handleFileChange} id="file-upload" />

      {isDraggingFiles && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed border-primary/50 bg-background/65 backdrop-blur-[1px]">
          <div className="rounded-lg bg-background/95 px-4 py-3 shadow-sm border border-primary/30">
            <p className="text-sm font-medium text-foreground">Drop files to upload</p>
            <p className="text-xs text-muted-foreground mt-1">Supported: PDF, TXT, CSV, DOCX, XLSX, PPTX, images, ZIP</p>
          </div>
        </div>
      )}

      <DashboardStats documents={[...allDocs, ...trashedDocs]} />

      <DocumentBrowseToolbar
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
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
            <DocumentCard key={doc.id} document={doc} onView={(selected) => setViewDocId(selected.id)} onRename={setRenameDoc} />
          ))}
        </div>
      ) : (
        <DocumentListView documents={paginatedDocuments} onView={(selected) => setViewDocId(selected.id)} onRename={setRenameDoc} />
      )}
      <DocumentViewer document={viewDoc} open={!!viewDocId} onClose={() => setViewDocId(null)} />
      <RenameDialog document={renameDoc} open={!!renameDoc} onClose={() => setRenameDoc(null)} />
    </div>
  );
}
