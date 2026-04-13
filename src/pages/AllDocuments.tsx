import { useState, useRef, useCallback, useMemo } from 'react';
import { useDocuments, useDocumentMutations, Document } from '@/hooks/useDocuments';
import DashboardStats from '@/components/DashboardStats';
import DocumentCard from '@/components/DocumentCard';
import DocumentListView from '@/components/DocumentListView';
import DocumentViewer from '@/components/DocumentViewer';
import RenameDialog from '@/components/RenameDialog';

type Props = {
  viewMode: 'grid' | 'list';
  search: string;
  uploadTrigger: number;
};

export default function AllDocuments({ viewMode, search, uploadTrigger }: Props) {
  const { data: allDocs = [] } = useDocuments();
  const { data: trashedDocs = [] } = useDocuments({ trashed: true });
  const { uploadDocument } = useDocumentMutations();
  const [viewDocId, setViewDocId] = useState<string | null>(null);
  const [renameDoc, setRenameDoc] = useState<Document | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filtered = allDocs.filter((d) =>
    d.name.toLowerCase().includes(search.toLowerCase())
  );
  const viewDoc = useMemo(
    () => allDocs.find((doc) => doc.id === viewDocId) ?? null,
    [allDocs, viewDocId]
  );

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((f) => uploadDocument.mutate(f));
    e.target.value = '';
  }, [uploadDocument]);

  return (
    <div className="space-y-6">
      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileChange} id="file-upload" />
      <DashboardStats documents={[...allDocs, ...trashedDocs]} />
      {filtered.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-muted-foreground text-sm">No documents yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Upload your first document to get started</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((doc) => (
            <DocumentCard key={doc.id} document={doc} onView={(selected) => setViewDocId(selected.id)} onRename={setRenameDoc} />
          ))}
        </div>
      ) : (
        <DocumentListView documents={filtered} onView={(selected) => setViewDocId(selected.id)} onRename={setRenameDoc} />
      )}
      <DocumentViewer document={viewDoc} open={!!viewDocId} onClose={() => setViewDocId(null)} />
      <RenameDialog document={renameDoc} open={!!renameDoc} onClose={() => setRenameDoc(null)} />
    </div>
  );
}
